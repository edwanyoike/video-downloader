# Design Document: video-downloader

## Overview

The video-downloader is a self-hosted, production-grade web application that lets users download videos from eleven social media and video-hosting platforms. It is deployed at `dl.evarein.com` on an existing VPS behind Cloudflare and Nginx.

The system is split into two independent processes in two separate folders:

- **`frontend/`** — a Next.js 14 (React) application served on port 3000. Handles all UI rendering, client-side URL validation, Turnstile widget embedding, and SSE consumption. Styled with Tailwind CSS.
- **`backend/`** — a Fastify (Node.js) API server on port 3001. Handles metadata extraction, job queuing, progress streaming, and file delivery.

Each folder has its own `package.json` and is deployed as an independent process managed by PM2 on the VPS.

Nginx acts as the reverse proxy: requests to `/api/*` and `/health` are forwarded to Fastify; everything else goes to Next.js. Both processes share the existing Redis instance on the VPS (Bull queue + rate limiting). The existing PostgreSQL database is available but not used for job state — Bull/Redis handles that entirely.

yt-dlp is invoked as a child process via `child_process.spawn` with argument arrays (never shell strings). All temporary files live in a configurable directory and are deleted within 60 seconds of delivery.

### Project Structure

```
video-downloader/
├── frontend/                          # Next.js app (port 3000)
│   ├── app/
│   │   ├── page.tsx                   # universal / route
│   │   └── [platform]/
│   │       └── page.tsx               # /youtube, /tiktok, etc.
│   ├── components/
│   │   ├── UrlInput.tsx
│   │   ├── MediaPreview.tsx
│   │   ├── FormatSelector.tsx
│   │   ├── ProgressBar.tsx
│   │   └── TurnstileWidget.tsx
│   ├── lib/
│   │   └── urlValidator.ts            # client-side validation
│   ├── public/                        # platform logos, icons
│   ├── package.json
│   └── next.config.js
│
├── backend/                           # Fastify API server (port 3001)
│   ├── src/
│   │   ├── platforms/
│   │   │   └── registry.ts            # platform registry
│   │   ├── extractors/
│   │   │   └── ytdlp.ts               # yt-dlp wrapper
│   │   ├── workers/
│   │   │   └── downloadWorker.ts      # Bull queue worker
│   │   ├── routes/
│   │   │   ├── info.ts                # POST /api/info
│   │   │   ├── download.ts            # POST /api/download
│   │   │   ├── progress.ts            # GET /api/jobs/:id/progress (SSE)
│   │   │   └── file.ts                # GET /api/jobs/:id/file
│   │   ├── plugins/
│   │   │   └── rateLimiter.ts
│   │   ├── lib/
│   │   │   ├── turnstile.ts
│   │   │   ├── urlValidator.ts        # server-side validation + SSRF guard
│   │   │   └── sanitizeFilename.ts
│   │   └── server.ts
│   └── package.json
│
└── nginx/
    └── dl.evarein.com.conf            # Nginx server block
```

---

## Architecture

### Deployment Topology

```
Internet
   │
   ▼
Cloudflare (proxy, Turnstile, DDoS)
   │  CF-Connecting-IP header carries real client IP
   ▼
Nginx  (dl.evarein.com, TLS termination)
   ├── /api/*  ──► Fastify  :3001
   ├── /health ──► Fastify  :3001
   └── /*      ──► Next.js  :3000
                       │
                       └── (SSR + static assets)

Fastify :3001
   ├── Bull Queue  ──► Redis :6379
   ├── Rate Limiter ─► Redis :6379
   └── yt-dlp (child_process.spawn)
          └── writes to /tmp/vd-jobs/{jobId}/
```

### Request Flow — Metadata

```
Browser
  │  POST /api/info  { url }
  ▼
Fastify
  ├── IP rate-limit check (Redis)
  ├── URL validation + SSRF guard
  └── spawn yt-dlp --dump-json
          └── return InfoResult JSON to browser
```

### Request Flow — Download

```
Browser
  │  POST /api/download  { url, format, quality, options, turnstileToken }
  ▼
Fastify
  ├── IP rate-limit check (Redis)
  ├── Turnstile server-side verify (Cloudflare siteverify API)
  ├── Concurrent-job-per-IP check (Redis)
  ├── URL validation + SSRF guard
  └── Bull.add(job)  ──► returns { jobId }

Browser
  │  GET /api/jobs/:jobId/progress  (SSE)
  ▼
Fastify SSE handler
  └── subscribes to Bull job events via Redis pub/sub
        └── emits { stage, percent, eta } events

Bull Worker (same process)
  └── spawn yt-dlp with --progress-template JSON
        ├── parse stdout lines → job.updateProgress()
        └── on complete → file ready at /tmp/vd-jobs/{jobId}/output.*

Browser
  │  GET /api/jobs/:jobId/file
  ▼
Fastify
  └── pipe file stream → response (Content-Disposition: attachment)
        └── schedule file deletion after 60 s
```

---

## Components and Interfaces

### 1. Platform Registry

A single TypeScript module (`src/platforms/registry.ts`) that exports a `Map<string, PlatformConfig>`. Adding a new platform requires only one entry here — no changes to routing or download logic.

```typescript
interface PlatformConfig {
  id: string;                    // e.g. "youtube"
  displayName: string;           // e.g. "YouTube"
  domains: string[];             // allowed hostnames for SSRF guard
  urlPatterns: RegExp[];         // client-side + server-side validation
  trackingParams: string[];      // query params to strip before processing
  options: PlatformOption[];     // platform-specific UI controls
  ytdlpArgs: (opts: DownloadOptions) => string[]; // extra yt-dlp flags
}

interface PlatformOption {
  id: string;
  label: string;
  type: 'toggle' | 'select';
  values?: string[];
  default: unknown;
}
```

The registry is imported by both the Next.js frontend (for client-side validation and UI rendering) and the Fastify backend (for SSRF domain allowlist and yt-dlp argument construction).

**Registered platforms:**

| id | domains | Notable options |
|----|---------|-----------------|
| `youtube` | youtube.com, youtu.be | subtitles (lang), quality up to 4K |
| `instagram` | instagram.com | — |
| `tiktok` | tiktok.com, vm.tiktok.com | watermark toggle |
| `twitter` | twitter.com, x.com | quality select |
| `facebook` | facebook.com, fb.watch | — |
| `reddit` | reddit.com, v.redd.it | — |
| `vimeo` | vimeo.com | — |
| `twitch` | twitch.tv, clips.twitch.tv | — |
| `pinterest` | pinterest.com, pin.it | — |
| `linkedin` | linkedin.com | — |
| `dailymotion` | dailymotion.com | — |

### 2. URL Validator (`src/lib/urlValidator.ts`)

Shared between frontend and backend (compiled into both bundles).

```typescript
function validateUrl(raw: string, platformId?: string): ValidationResult

interface ValidationResult {
  valid: boolean;
  normalizedUrl?: string;   // https-normalised, tracking params stripped
  platformId?: string;      // detected platform
  error?: string;           // human-readable message
}
```

Logic:
1. Parse with `new URL(raw)` — reject if throws.
2. Coerce scheme to `https`.
3. Match hostname against all `PlatformConfig.domains` to detect platform.
4. If `platformId` is provided, reject if detected platform differs.
5. Strip `trackingParams` from the query string.
6. Return `normalizedUrl`.

Server-side additionally runs the SSRF guard (see Security section).

### 3. Metadata Extractor (`src/extractors/ytdlp.ts`)

Wraps `child_process.spawn` for metadata fetches.

```typescript
async function fetchMetadata(url: string): Promise<MediaInfo>
```

Invocation:
```
yt-dlp --dump-json --no-playlist --socket-timeout 15 <url>
```

Parses the single-line JSON output into `MediaInfo`. Timeout: 20 s wall-clock (kills the child process if exceeded).

### 4. Download Worker (`src/workers/downloadWorker.ts`)

A Bull worker that processes jobs from the `downloads` queue.

```typescript
queue.process('download', MAX_CONCURRENT_JOBS, async (job) => { ... })
```

Steps:
1. Build yt-dlp argument array from `job.data` (url, format, quality, platform options).
2. `spawn('yt-dlp', args, { cwd: jobDir })` — no shell.
3. Parse `--progress-template` JSON lines from stderr → call `job.progress(progressData)`.
4. On process exit 0: resolve with output file path.
5. On non-zero exit or timeout: reject with structured error.

### 5. SSE Progress Handler (`src/routes/progress.ts`)

```typescript
fastify.get('/api/jobs/:jobId/progress', async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',   // disable Nginx buffering
  });

  const job = await queue.getJob(jobId);
  // subscribe to Bull's global events via a dedicated Redis connection
  queueEvents.on('progress', ({ jobId, data }) => { ... });
  queueEvents.on('completed', ({ jobId }) => { ... });
  queueEvents.on('failed', ({ jobId, failedReason }) => { ... });

  req.raw.on('close', () => queueEvents.off(...));
});
```

SSE event format:
```
data: {"stage":"downloading","percent":42,"eta":18,"speed":"3.2 MiB/s"}\n\n
data: {"stage":"merging","percent":95,"eta":2}\n\n
data: {"stage":"complete","fileReady":true}\n\n
data: {"stage":"error","message":"..."}\n\n
```

### 6. File Delivery Handler (`src/routes/file.ts`)

```typescript
fastify.get('/api/jobs/:jobId/file', async (req, reply) => {
  // verify job belongs to requesting IP
  const filePath = await resolveJobFile(jobId, clientIp);
  const filename = sanitizeFilename(job.data.title, job.data.format);
  reply
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .header('Content-Type', mime.lookup(filePath) || 'application/octet-stream')
    .send(fs.createReadStream(filePath));
  // schedule deletion
  setTimeout(() => fs.rm(filePath, { force: true }), 60_000);
});
```

### 7. Rate Limiter (`src/plugins/rateLimiter.ts`)

Fastify plugin using `@fastify/rate-limit` backed by the existing Redis instance.

| Route | Limit | Window |
|-------|-------|--------|
| `POST /api/info` | 20 req | 60 s per IP |
| `POST /api/download` | 5 concurrent jobs | — (checked via Redis SET NX) |

Client IP is always read from `req.headers['cf-connecting-ip']` (string, first value). Falls back to `req.ip` in non-Cloudflare environments (dev/test).

### 8. Turnstile Verifier (`src/lib/turnstile.ts`)

```typescript
async function verifyTurnstileToken(token: string, ip: string): Promise<boolean>
```

POSTs to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response` (token), and `remoteip`. Returns `true` only when `success === true`. Called before any download job is created.

### 9. Frontend — Platform Page (`app/[platform]/page.tsx`)

Each platform route is a Next.js dynamic segment. The page:
1. Loads `PlatformConfig` from the registry (shared module).
2. Renders the URL input with client-side validation (< 100 ms, no server round-trip).
3. On valid URL submission: calls `POST /api/info` and displays `MediaInfo`.
4. Renders format/quality selectors populated from `MediaInfo.formats`.
5. On download click: obtains Turnstile token → calls `POST /api/download` → opens SSE stream → shows progress bar → triggers file download via `window.location` or `<a>` click.

### 10. Health Endpoint

```
GET /health → 200 { "status": "ok", "queue": { "waiting": N, "active": N } }
```

---

## Data Models

### `MediaInfo` (returned by `POST /api/info`)

```typescript
interface MediaInfo {
  id: string;               // platform-native video ID
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  uploaderName: string;
  platformId: string;
  formats: FormatOption[];
  subtitles?: SubtitleTrack[];  // YouTube only
}

interface FormatOption {
  formatId: string;         // yt-dlp format code, e.g. "137+140"
  label: string;            // "1080p MP4", "Audio only MP3"
  container: string;        // "mp4" | "webm" | "mp3" | "m4a"
  qualityLabel: string;     // "1080p" | "720p" | "audio"
  fileSizeBytes?: number;   // estimated, may be absent
  isAudioOnly: boolean;
  isDefault: boolean;
}

interface SubtitleTrack {
  language: string;         // BCP-47, e.g. "en"
  languageName: string;     // "English"
  formats: ('srt' | 'vtt')[];
}
```

### `DownloadJobData` (stored in Bull job)

```typescript
interface DownloadJobData {
  url: string;              // normalised URL
  platformId: string;
  formatId: string;
  title: string;            // for filename generation
  clientIp: string;
  options: {
    subtitleLang?: string;  // YouTube
    subtitleFormat?: 'srt' | 'vtt';
    noWatermark?: boolean;  // TikTok
  };
  createdAt: number;        // Unix ms
}
```

### `JobProgressData` (emitted via `job.progress()`)

```typescript
interface JobProgressData {
  stage: 'queued' | 'downloading' | 'merging' | 'complete' | 'error';
  percent: number;          // 0–100
  eta?: number;             // seconds remaining
  speed?: string;           // "3.2 MiB/s"
  message?: string;         // error message when stage === 'error'
  fileReady?: boolean;      // true when stage === 'complete'
}
```

### `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  platformId?: string;
  error?: 'MALFORMED' | 'UNSUPPORTED_PLATFORM' | 'PLATFORM_MISMATCH' | 'SSRF_BLOCKED';
  errorMessage?: string;
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default 3001) | Fastify listen port |
| `REDIS_URL` | Yes | Redis connection string |
| `TEMP_DIR` | No (default `/tmp/vd-jobs`) | Temp file storage root |
| `MAX_CONCURRENT_JOBS` | No (default 3) | Bull worker concurrency |
| `YTDLP_PATH` | No (default `yt-dlp`) | Path to yt-dlp binary |
| `TURNSTILE_SECRET_KEY` | Yes | Cloudflare Turnstile secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile site key (frontend) |
| `YOUTUBE_COOKIES_FILE` | No | Path to cookies.txt for age-restricted content |
| `RATE_LIMIT_INFO_RPM` | No (default 20) | Metadata requests per minute per IP |
| `RATE_LIMIT_MAX_CONCURRENT` | No (default 5) | Max concurrent download jobs per IP |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: URL normalisation is idempotent

*For any* URL that passes validation, applying the normalisation function a second time produces the same result as applying it once — the scheme is `https`, tracking parameters are absent, and the URL is otherwise unchanged.

**Validates: Requirements 2.4, 2.5**

### Property 2: Tracking-parameter stripping removes only tracking params

*For any* URL containing a mix of tracking parameters (UTM, referral tokens defined in the platform registry) and non-tracking query parameters, the normalised URL retains all non-tracking parameters and contains none of the tracking parameters.

**Validates: Requirements 2.5**

### Property 3: Platform mismatch is always detected

*For any* URL that belongs to platform A (its hostname matches platform A's domain list), submitting it to the validator with `platformId = B` (where A ≠ B) always returns a `PLATFORM_MISMATCH` error and never returns `valid: true`.

**Validates: Requirements 2.3**

### Property 4: SSRF guard rejects all private-range and loopback URLs

*For any* URL whose hostname resolves to an address within RFC 1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8, ::1), or link-local (169.254.0.0/16), the server-side SSRF guard always returns `SSRF_BLOCKED` and never passes the URL to yt-dlp or any outbound network call.

**Validates: Requirements 13.4**

### Property 5: Sanitized filename contains no illegal filesystem characters

*For any* video title string — including arbitrary Unicode, emoji, path separators (`/`, `\`), null bytes, and ASCII control characters — the sanitized filename produced by `sanitizeFilename()` contains only characters that are legal on Windows (NTFS), macOS (HFS+), and Linux (ext4) filesystems, and has a non-zero length.

**Validates: Requirements 5.3**

### Property 6: Rate-limit window enforces maximum submissions per IP

*For any* sequence of more than 20 requests to `POST /api/info` from the same IP address within a 60-second window, every request after the 20th returns HTTP 429 with a `Retry-After` header, and no metadata fetch is initiated for those rejected requests.

**Validates: Requirements 11.1, 11.2**

### Property 7: Concurrent job limit is enforced per IP

*For any* IP address that already has 5 active download jobs, any additional `POST /api/download` request from that IP returns HTTP 429 and no new Bull job is created, regardless of the Turnstile token validity.

**Validates: Requirements 5.6, 11.3**

### Property 8: Job progress percent is non-decreasing

*For any* sequence of `JobProgressData` values emitted by the download worker for a single job, the `percent` field is monotonically non-decreasing — each emitted value is greater than or equal to the previously emitted value, and the final value is 100 when the stage is `complete`.

**Validates: Requirements 5.2**

### Property 9: Turnstile rejection always blocks job creation

*For any* request to `POST /api/download` where the Cloudflare Turnstile siteverify API returns `success: false` (including absent token, invalid token, or already-used token), no Bull job is created, the response status is 403, and the response body contains no internal error details.

**Validates: Requirements 14.2, 14.3, 14.4**

### Property 10: Format label round-trip

*For any* `FormatOption` record with valid `qualityLabel` and `container` fields, the `label` string generated by `buildFormatLabel()` contains both the `qualityLabel` and `container` as substrings, and parsing the label back with `parseFormatLabel()` yields values equal to the original fields.

**Validates: Requirements 4.5**

### Property 11: MediaInfo always contains all required fields

*For any* yt-dlp JSON output that represents a single video (not a playlist), the `parseMediaInfo()` function produces a `MediaInfo` object where `id`, `title`, `thumbnailUrl`, `durationSeconds`, `uploaderName`, `platformId`, and `formats` are all present and non-empty.

**Validates: Requirements 3.2**

### Property 12: yt-dlp error patterns map to correct AppError types

*For any* yt-dlp stderr string containing a known error pattern (private video, unavailable, age-restricted, geo-restricted, unsupported URL), `classifyYtdlpError()` returns the corresponding `AppError` type and never returns a generic error when a specific classification is possible.

**Validates: Requirements 3.5, 12.1**

### Property 13: Security headers are present on all responses

*For any* HTTP request to any endpoint on the Fastify server, the response always includes `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security` headers with non-empty values.

**Validates: Requirements 13.3**

### Property 14: Collection completeness in rendering

*For any* data collection of N items (format options, subtitle tracks, or multi-media post items), the rendering function produces output containing exactly N selectable or displayable elements — no items are silently dropped or duplicated.

**Validates: Requirements 4.1, 6.2, 7.2**

---

## Error Handling

### Error Classification

| Class | HTTP Status | User-visible message | Logged |
|-------|-------------|----------------------|--------|
| Malformed URL | 400 | "That doesn't look like a valid URL." | No |
| Unsupported platform | 400 | "This platform isn't supported yet." | No |
| Platform mismatch | 400 | "That URL belongs to [X], not [Y]." | No |
| SSRF blocked | 400 | "That URL isn't allowed." | Yes (warn) |
| Rate limit exceeded | 429 | "Too many requests. Try again in Xs." | Yes (info) |
| Turnstile failure | 403 | "Bot check failed. Please try again." | Yes (warn) |
| Metadata timeout | 504 | "Couldn't reach [Platform]. Try again." | Yes (error) |
| Private/deleted content | 422 | "This video is private or unavailable." | No |
| Geo-restricted content | 422 | "This video isn't available in your region." | No |
| Download job failure | 500 | "Download failed. Please retry." | Yes (error, full stack) |
| Job timeout (60 s) | 504 | "Download timed out. Please retry." | Yes (error) |
| Missing env var at startup | — | Logged to stderr, process exits 1 | Yes (fatal) |

### yt-dlp Error Mapping

yt-dlp exit codes and stderr patterns are mapped to structured errors before being surfaced to the user. The raw stderr is never forwarded to the client.

```typescript
function classifyYtdlpError(stderr: string, exitCode: number): AppError
```

Key patterns:
- `"Private video"` → `CONTENT_PRIVATE`
- `"Video unavailable"` → `CONTENT_UNAVAILABLE`
- `"Sign in to confirm your age"` → `AGE_RESTRICTED`
- `"This video is not available in your country"` → `GEO_RESTRICTED`
- `"Unsupported URL"` → `UNSUPPORTED_URL`
- Timeout (SIGTERM) → `EXTRACTOR_TIMEOUT`

### Resource Cleanup

When a job fails or is cancelled:
1. The Bull worker catches the error and calls `job.moveToFailed()`.
2. A Bull `failed` event listener deletes the job's temp directory.
3. The SSE handler receives the `failed` event and sends a final `error` event before closing the stream.
4. The concurrent-job counter in Redis is decremented via a `finally` block.

---

## Testing Strategy

### Unit Tests (Vitest)

Focus on pure functions and logic that doesn't require external services:

- `urlValidator.ts` — valid/invalid URLs, scheme normalisation, tracking-param stripping, platform detection, SSRF guard
- `sanitizeFilename.ts` — illegal characters, Unicode, length limits
- `ytdlpErrorMapper.ts` — stderr pattern matching → AppError classification
- `formatLabel.ts` — label generation and round-trip parsing
- `platformRegistry.ts` — all platforms registered, required fields present

### Property-Based Tests (fast-check, minimum 100 iterations each)

Library: **fast-check** (`npm install --save-dev fast-check`). Each property test is tagged with a comment referencing the design property it validates. Configure with `{ numRuns: 100 }` minimum.

```typescript
// Feature: video-downloader, Property 1: URL normalisation is idempotent
// Feature: video-downloader, Property 2: Tracking-parameter stripping removes only tracking params
// Feature: video-downloader, Property 3: Platform mismatch is always detected
// Feature: video-downloader, Property 4: SSRF guard rejects all private-range and loopback URLs
// Feature: video-downloader, Property 5: Sanitized filename contains no illegal filesystem characters
// Feature: video-downloader, Property 6: Rate-limit window enforces maximum submissions per IP
// Feature: video-downloader, Property 7: Concurrent job limit is enforced per IP
// Feature: video-downloader, Property 8: Job progress percent is non-decreasing
// Feature: video-downloader, Property 9: Turnstile rejection always blocks job creation
// Feature: video-downloader, Property 10: Format label round-trip
// Feature: video-downloader, Property 11: MediaInfo always contains all required fields
// Feature: video-downloader, Property 12: yt-dlp error patterns map to correct AppError types
// Feature: video-downloader, Property 13: Security headers are present on all responses
// Feature: video-downloader, Property 14: Collection completeness in rendering
```

fast-check generators needed:
- `fc.webUrl()` — arbitrary URLs for normalisation and platform-mismatch tests
- `fc.string()` — arbitrary titles for filename sanitisation
- `fc.ipV4()` / `fc.ipV6()` — for SSRF guard tests (combined with RFC 1918 range generators)
- `fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1 })` — for progress sequence tests
- Custom `fc.record(...)` generators for `FormatOption`, `MediaInfo`, and `DownloadJobData`
- Custom generator for yt-dlp JSON output fixtures (random title, duration, format lists)
- Custom generator for yt-dlp stderr strings containing known error patterns

### Integration Tests

- `POST /api/info` with a real yt-dlp invocation against a known-stable public video (or a mock yt-dlp binary that returns fixture JSON)
- `POST /api/download` → SSE stream → file delivery end-to-end (using mock yt-dlp)
- Rate limiter: verify 429 after N+1 requests within window
- Turnstile: verify 403 when mock siteverify returns `success: false`

### End-to-End Tests (Playwright)

- Happy path: paste URL → see metadata → select format → download file
- Error path: paste unsupported URL → see inline error within 100 ms
- Rate limit: trigger 429 → see user-friendly message

---

## Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name dl.evarein.com;

    # TLS managed by Certbot / Cloudflare Origin Certificate
    ssl_certificate     /etc/letsencrypt/live/dl.evarein.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dl.evarein.com/privkey.pem;

    # Security headers (Fastify also sets these; Nginx adds them for Next.js responses)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API → Fastify
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   Connection        "";

        # SSE: disable buffering for /api/jobs/*/progress
        location ~ ^/api/jobs/[^/]+/progress$ {
            proxy_pass             http://127.0.0.1:3001;
            proxy_http_version     1.1;
            proxy_set_header       Connection "";
            proxy_buffering        off;
            proxy_cache            off;
            proxy_read_timeout     3600s;
            chunked_transfer_encoding on;
        }

        # File delivery: allow large responses, extended timeout
        location ~ ^/api/jobs/[^/]+/file$ {
            proxy_pass           http://127.0.0.1:3001;
            proxy_http_version   1.1;
            proxy_read_timeout   120s;
            proxy_send_timeout   120s;
            proxy_buffering      off;
        }
    }

    # Health check → Fastify
    location /health {
        proxy_pass http://127.0.0.1:3001;
    }

    # Everything else → Next.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name dl.evarein.com;
    return 301 https://$host$request_uri;
}
```

Key decisions:
- `proxy_buffering off` on the SSE route prevents Nginx from holding SSE frames in its buffer, which would break real-time delivery.
- `proxy_read_timeout 3600s` on SSE keeps the long-lived connection alive.
- `X-Accel-Buffering: no` is also set by Fastify on SSE responses as a belt-and-suspenders measure.
- File delivery uses `proxy_buffering off` to stream large files without loading them into Nginx memory.

---

## Security Design

### Input Validation Pipeline

```
Raw user input
  │
  ├─ 1. URL parse (new URL())          — rejects non-URLs
  ├─ 2. Scheme check                   — only http/https accepted
  ├─ 3. Platform domain allowlist      — hostname must match registry
  ├─ 4. SSRF guard (server-side only)  — DNS resolve + RFC 1918 check
  ├─ 5. Tracking param strip           — removes UTM etc.
  └─ 6. Pass normalised URL to yt-dlp via argument array (no shell)
```

### yt-dlp Invocation (no shell injection)

```typescript
const args = [
  '--dump-json',
  '--no-playlist',
  '--socket-timeout', '15',
  ...platformConfig.ytdlpArgs(options),
  normalizedUrl,   // always last, never interpolated into a string
];
spawn(YTDLP_PATH, args, { shell: false, cwd: jobDir });
```

`shell: false` is the default for `spawn` but is set explicitly for clarity. The URL is passed as a discrete array element, never concatenated into a command string.

### HTTP Security Headers (Fastify plugin)

```typescript
fastify.addHook('onSend', (req, reply, payload, done) => {
  reply
    .header('Content-Security-Policy', "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'")
    .header('X-Content-Type-Options', 'nosniff')
    .header('X-Frame-Options', 'DENY')
    .header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  done(null, payload);
});
```

The CSP allows `challenges.cloudflare.com` for the Turnstile iframe and script.

### Temp File Lifecycle

```
Job created  → mkdir /tmp/vd-jobs/{jobId}/
Job running  → yt-dlp writes output.* into that directory
Job complete → file served via streaming read
60 s later   → fs.rm(jobDir, { recursive: true, force: true })
Job failed   → fs.rm(jobDir, ...) in Bull 'failed' event handler
Job timeout  → SIGTERM to yt-dlp child → fs.rm(jobDir, ...)
```

A startup sweep removes any orphaned directories older than 10 minutes (handles crash recovery).
