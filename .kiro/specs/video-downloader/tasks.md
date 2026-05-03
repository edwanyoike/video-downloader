# Implementation Plan: video-downloader

## Overview

Implement a self-hosted video downloader with a Next.js 14 frontend (port 3000) and a Fastify backend (port 3001), connected via Nginx reverse proxy. The backend uses yt-dlp via `child_process.spawn`, Bull + Redis for job queuing, Cloudflare Turnstile for bot protection, and SSE for real-time progress streaming. The frontend provides platform-specific routes, client-side URL validation, and a clean Tailwind CSS UI. All 14 correctness properties are covered by fast-check property-based tests.

## Tasks

- [x] 1. Project scaffolding and shared types
  - Initialise `backend/` with `npm init`, install Fastify, Bull, ioredis, @fastify/rate-limit, mime-types, fast-check, vitest, and TypeScript dependencies
  - Initialise `frontend/` with `create-next-app` (Next.js 14, TypeScript, Tailwind CSS, App Router)
  - Create `backend/tsconfig.json` targeting ES2022, `moduleResolution: bundler`
  - Create shared TypeScript interfaces (`MediaInfo`, `FormatOption`, `SubtitleTrack`, `DownloadJobData`, `JobProgressData`, `ValidationResult`, `PlatformConfig`, `PlatformOption`) in `backend/src/types.ts` and mirror them in `frontend/lib/types.ts`
  - Add `.env.example` files to both `frontend/` and `backend/` listing all required and optional environment variables from the design
  - Add startup env-var validation in `backend/src/server.ts` that logs a descriptive error and exits with code 1 if `REDIS_URL` or `TURNSTILE_SECRET_KEY` are absent
  - _Requirements: 15.1, 15.2_

- [ ] 2. Platform registry
  - [x] 2.1 Implement `backend/src/platforms/registry.ts`
    - Define `PlatformConfig` and `PlatformOption` interfaces
    - Register all 11 platforms: `youtube`, `instagram`, `tiktok`, `twitter`, `facebook`, `reddit`, `vimeo`, `twitch`, `pinterest`, `linkedin`, `dailymotion` with their `domains`, `urlPatterns`, `trackingParams`, `options`, and `ytdlpArgs` factories
    - Export a `PLATFORM_REGISTRY: Map<string, PlatformConfig>` and a `detectPlatform(hostname: string): PlatformConfig | undefined` helper
    - _Requirements: 1.1, 15.4_

  - [ ]* 2.2 Write unit tests for platform registry
    - Verify all 11 platforms are registered with required fields (`id`, `displayName`, `domains`, `urlPatterns`, `ytdlpArgs`)
    - Verify `detectPlatform` returns the correct config for each platform's known domains
    - _Requirements: 1.1, 15.4_

  - [x] 2.3 Copy registry to `frontend/lib/platformRegistry.ts`
    - Duplicate `registry.ts` into the frontend bundle (omit `ytdlpArgs` if not needed client-side, or keep it for completeness)
    - _Requirements: 1.1_

- [ ] 3. URL validator
  - [x] 3.1 Implement `backend/src/lib/urlValidator.ts`
    - Implement `validateUrl(raw: string, platformId?: string): ValidationResult`
    - Step 1: parse with `new URL(raw)` — return `MALFORMED` on throw
    - Step 2: coerce scheme to `https`
    - Step 3: match hostname against `PLATFORM_REGISTRY` domains — return `UNSUPPORTED_PLATFORM` if no match
    - Step 4: if `platformId` provided and detected platform differs — return `PLATFORM_MISMATCH`
    - Step 5: strip `trackingParams` from query string
    - Step 6 (server-side only): DNS-resolve hostname and reject RFC 1918 / loopback / link-local addresses with `SSRF_BLOCKED`
    - Return `{ valid: true, normalizedUrl, platformId }` on success
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 13.4_

  - [ ]* 3.2 Write property test — Property 1: URL normalisation is idempotent
    - **Property 1: URL normalisation is idempotent**
    - **Validates: Requirements 2.4, 2.5**
    - Use `fc.webUrl()` to generate arbitrary valid URLs; assert `validateUrl(validateUrl(url).normalizedUrl!).normalizedUrl === validateUrl(url).normalizedUrl`

  - [ ]* 3.3 Write property test — Property 2: Tracking-parameter stripping removes only tracking params
    - **Property 2: Tracking-parameter stripping removes only tracking params**
    - **Validates: Requirements 2.5**
    - Generate URLs with a mix of tracking and non-tracking query params; assert all non-tracking params are retained and all tracking params are absent in `normalizedUrl`

  - [ ]* 3.4 Write property test — Property 3: Platform mismatch is always detected
    - **Property 3: Platform mismatch is always detected**
    - **Validates: Requirements 2.3**
    - For each pair of distinct platforms A and B, generate a URL matching platform A's domain; assert `validateUrl(url, B.id).error === 'PLATFORM_MISMATCH'` and `valid === false`

  - [ ]* 3.5 Write property test — Property 4: SSRF guard rejects all private-range and loopback URLs
    - **Property 4: SSRF guard rejects all private-range and loopback URLs**
    - **Validates: Requirements 13.4**
    - Generate URLs with hostnames in RFC 1918 ranges, loopback, and link-local using custom `fc.ipV4()` generators; assert every result has `error === 'SSRF_BLOCKED'` and `valid === false`

  - [x] 3.6 Copy URL validator to `frontend/lib/urlValidator.ts`
    - Duplicate the client-safe portion (steps 1–5, no DNS resolution) into the frontend bundle
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4. Filename sanitizer
  - [x] 4.1 Implement `backend/src/lib/sanitizeFilename.ts`
    - Implement `sanitizeFilename(title: string, format: string): string`
    - Strip null bytes, ASCII control characters, and characters illegal on NTFS/HFS+/ext4 (`/ \ : * ? " < > |`)
    - Collapse consecutive whitespace and dots; trim leading/trailing whitespace and dots
    - Truncate to 200 characters before appending the format extension
    - Ensure result is never empty (fall back to `"download"`)
    - _Requirements: 5.3_

  - [ ]* 4.2 Write property test — Property 5: Sanitized filename contains no illegal filesystem characters
    - **Property 5: Sanitized filename contains no illegal filesystem characters**
    - **Validates: Requirements 5.3**
    - Use `fc.string()` (including Unicode, emoji, path separators, null bytes, control chars) as title input; assert output contains only legal filesystem characters and has non-zero length

- [ ] 5. Format label builder
  - [x] 5.1 Implement `backend/src/lib/formatLabel.ts`
    - Implement `buildFormatLabel(qualityLabel: string, container: string, isAudioOnly: boolean): string` — e.g. `"1080p MP4"`, `"Audio only MP3"`
    - Implement `parseFormatLabel(label: string): { qualityLabel: string; container: string }` for round-trip validation
    - _Requirements: 4.5_

  - [ ]* 5.2 Write property test — Property 10: Format label round-trip
    - **Property 10: Format label round-trip**
    - **Validates: Requirements 4.5**
    - Use `fc.record({ qualityLabel: fc.string(), container: fc.string() })` to generate inputs; assert `buildFormatLabel` output contains both substrings and `parseFormatLabel(buildFormatLabel(...))` round-trips correctly

- [ ] 6. yt-dlp error classifier
  - [x] 6.1 Implement `backend/src/lib/ytdlpErrorMapper.ts`
    - Implement `classifyYtdlpError(stderr: string, exitCode: number): AppError`
    - Map known stderr patterns to typed errors: `CONTENT_PRIVATE`, `CONTENT_UNAVAILABLE`, `AGE_RESTRICTED`, `GEO_RESTRICTED`, `UNSUPPORTED_URL`, `EXTRACTOR_TIMEOUT`
    - Return a generic `DOWNLOAD_FAILED` only when no specific pattern matches
    - Never forward raw stderr to callers
    - _Requirements: 3.5, 12.1_

  - [ ]* 6.2 Write property test — Property 12: yt-dlp error patterns map to correct AppError types
    - **Property 12: yt-dlp error patterns map to correct AppError types**
    - **Validates: Requirements 3.5, 12.1**
    - Use a custom `fc.oneof(...)` generator that produces stderr strings containing each known error pattern; assert `classifyYtdlpError` returns the specific (non-generic) error type for every known pattern

- [x] 7. Checkpoint — core library tests pass
  - Run `vitest --run` in `backend/` and confirm all unit and property tests for the URL validator, filename sanitizer, format label builder, and error classifier pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Metadata extractor
  - [x] 8.1 Implement `backend/src/extractors/ytdlp.ts`
    - Implement `fetchMetadata(url: string): Promise<MediaInfo>`
    - Spawn `yt-dlp --dump-json --no-playlist --socket-timeout 15 <url>` with `shell: false`
    - Parse single-line JSON stdout into `MediaInfo` (map yt-dlp fields to `id`, `title`, `thumbnailUrl`, `durationSeconds`, `uploaderName`, `platformId`, `formats`, `subtitles`)
    - Implement `parseMediaInfo(ytdlpJson: object, platformId: string): MediaInfo`
    - Kill child process and throw `EXTRACTOR_TIMEOUT` if wall-clock exceeds 20 s
    - On non-zero exit, call `classifyYtdlpError` and throw the resulting `AppError`
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [ ]* 8.2 Write property test — Property 11: MediaInfo always contains all required fields
    - **Property 11: MediaInfo always contains all required fields**
    - **Validates: Requirements 3.2**
    - Use a custom `fc.record(...)` generator that produces yt-dlp-shaped JSON objects for single videos; assert `parseMediaInfo` always produces a `MediaInfo` where `id`, `title`, `thumbnailUrl`, `durationSeconds`, `uploaderName`, `platformId`, and `formats` are all present and non-empty

- [ ] 9. Turnstile verifier
  - [x] 9.1 Implement `backend/src/lib/turnstile.ts`
    - Implement `verifyTurnstileToken(token: string, ip: string): Promise<boolean>`
    - POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`, and `remoteip`
    - Return `true` only when `success === true` in the response body
    - Read `TURNSTILE_SECRET_KEY` from environment; never hardcode it
    - _Requirements: 14.2, 14.3, 14.6_

- [ ] 10. Rate limiter plugin
  - [x] 10.1 Implement `backend/src/plugins/rateLimiter.ts`
    - Register `@fastify/rate-limit` with the existing Redis instance
    - Apply 20 req/60 s per IP to `POST /api/info` using `CF-Connecting-IP` (fallback to `req.ip`)
    - Implement concurrent-job-per-IP check using Redis `SET NX` with TTL: reject with HTTP 429 if IP already has 5 active jobs
    - Return `Retry-After` header on all 429 responses
    - Log each rate-limit violation with IP, timestamp, and path
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 10.2 Write property test — Property 6: Rate-limit window enforces maximum submissions per IP
    - **Property 6: Rate-limit window enforces maximum submissions per IP**
    - **Validates: Requirements 11.1, 11.2**
    - Simulate sequences of more than 20 requests from the same IP within a 60 s window using a mock Redis; assert every request after the 20th returns 429 with `Retry-After` and no metadata fetch is initiated

  - [ ]* 10.3 Write property test — Property 7: Concurrent job limit is enforced per IP
    - **Property 7: Concurrent job limit is enforced per IP**
    - **Validates: Requirements 5.6, 11.3**
    - Simulate an IP with 5 active jobs in mock Redis; assert any additional `POST /api/download` returns 429 and no Bull job is created, regardless of Turnstile token

- [x] 11. HTTP security headers plugin
  - Implement a Fastify `onSend` hook in `backend/src/plugins/securityHeaders.ts` that sets `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security` on every response
  - CSP must allow `challenges.cloudflare.com` for the Turnstile iframe and script
  - _Requirements: 13.3_

  - [ ]* 11.1 Write property test — Property 13: Security headers are present on all responses
    - **Property 13: Security headers are present on all responses**
    - **Validates: Requirements 13.3**
    - Use `fc.constantFrom(...allRoutes)` to generate arbitrary route/method combinations; inject the Fastify app and assert every response includes all four required security headers with non-empty values

- [ ] 12. Bull queue and download worker
  - [x] 12.1 Set up Bull queue in `backend/src/workers/downloadWorker.ts`
    - Create a `downloads` Bull queue connected to Redis via `REDIS_URL`
    - Implement `queue.process('download', MAX_CONCURRENT_JOBS, async (job) => { ... })`
    - Build yt-dlp argument array from `job.data` (url, formatId, platform options, optional cookies file) using `platformConfig.ytdlpArgs(options)`
    - Spawn `yt-dlp` with `shell: false`, `cwd: jobDir` (`/tmp/vd-jobs/{jobId}/`)
    - Parse `--progress-template` JSON lines from stderr → call `job.progress(progressData)` with `{ stage, percent, eta, speed }`
    - On exit 0: resolve with output file path
    - On non-zero exit or 60 s timeout: SIGTERM child, call `classifyYtdlpError`, reject with structured error
    - _Requirements: 5.1, 5.2, 12.3_

  - [x] 12.2 Implement resource cleanup in the worker
    - On job `failed` event: `fs.rm(jobDir, { recursive: true, force: true })`
    - On job `completed` event: schedule `fs.rm(jobDir, ...)` after 60 s
    - On worker startup: sweep `/tmp/vd-jobs/` and delete directories older than 10 minutes
    - Decrement concurrent-job Redis counter in a `finally` block
    - _Requirements: 12.4, 13.5_

  - [ ]* 12.3 Write property test — Property 8: Job progress percent is non-decreasing
    - **Property 8: Job progress percent is non-decreasing**
    - **Validates: Requirements 5.2**
    - Use `fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2 })` to generate progress sequences; feed them through the progress-update logic and assert each emitted `percent` is ≥ the previous value and the final value is 100 when `stage === 'complete'`

- [ ] 13. Fastify routes — `/api/info` and `/api/download`
  - [x] 13.1 Implement `backend/src/routes/info.ts`
    - `POST /api/info` — apply IP rate limit (20/60 s), validate URL with `validateUrl`, call `fetchMetadata`, return `MediaInfo` JSON
    - Return structured error responses for all `AppError` types (see error classification table in design)
    - No Turnstile check on this route
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 14.7_

  - [x] 13.2 Implement `backend/src/routes/download.ts`
    - `POST /api/download` — apply IP rate limit, verify Turnstile token via `verifyTurnstileToken`, check concurrent-job limit, validate URL, enqueue Bull job, return `{ jobId }`
    - Read client IP from `CF-Connecting-IP` header (fallback to `req.ip`)
    - Return HTTP 403 if Turnstile fails; return HTTP 429 if rate/concurrency limit exceeded
    - _Requirements: 5.1, 14.2, 14.3, 14.4, 11.3_

  - [ ]* 13.3 Write property test — Property 9: Turnstile rejection always blocks job creation
    - **Property 9: Turnstile rejection always blocks job creation**
    - **Validates: Requirements 14.2, 14.3, 14.4**
    - Mock the Turnstile siteverify API to return `success: false` for arbitrary tokens (absent, invalid, reused); assert every such request returns HTTP 403, no Bull job is created, and the response body contains no internal error details

- [ ] 14. Fastify routes — SSE progress and file delivery
  - [x] 14.1 Implement `backend/src/routes/progress.ts`
    - `GET /api/jobs/:jobId/progress` — set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`)
    - Subscribe to Bull queue events (`progress`, `completed`, `failed`) via a dedicated Redis connection
    - Emit `data: {...}\n\n` frames with `{ stage, percent, eta, speed }` on progress; emit `{ stage: 'complete', fileReady: true }` on completion; emit `{ stage: 'error', message }` on failure
    - Clean up event listeners on `req.raw.on('close', ...)`
    - _Requirements: 5.2_

  - [x] 14.2 Implement `backend/src/routes/file.ts`
    - `GET /api/jobs/:jobId/file` — verify job belongs to requesting IP, resolve output file path, set `Content-Disposition: attachment; filename="<sanitizedFilename>"` and correct `Content-Type`
    - Stream file via `fs.createReadStream` → `reply.send()`
    - Schedule `fs.rm(jobDir, ...)` after 60 s
    - _Requirements: 5.3, 5.4, 13.5_

- [x] 15. Health endpoint and server bootstrap
  - Implement `GET /health` in `backend/src/routes/health.ts` returning `{ status: 'ok', queue: { waiting, active } }`
  - Wire all routes, plugins (rate limiter, security headers), and the Bull worker into `backend/src/server.ts`
  - Register `@fastify/cors` restricted to the frontend origin
  - Start listening on `PORT` (default 3001)
  - _Requirements: 15.3_

- [x] 16. Checkpoint — backend integration tests pass
  - Write integration tests in `backend/src/tests/integration/` using Vitest and a mock yt-dlp binary (returns fixture JSON)
  - Test `POST /api/info` happy path and error paths (private video, timeout, unsupported URL)
  - Test `POST /api/download` → SSE stream → file delivery end-to-end
  - Test rate limiter: verify HTTP 429 after N+1 requests within window
  - Test Turnstile: verify HTTP 403 when mock siteverify returns `success: false`
  - Run `vitest --run` in `backend/` and confirm all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.1, 5.1, 5.2, 5.3, 11.1, 14.3_

- [ ] 17. Frontend — layout, universal page, and platform pages
  - [x] 17.1 Implement root layout and universal download page (`frontend/app/page.tsx`)
    - Create `app/layout.tsx` with Tailwind base styles, `<html lang="en">`, and Turnstile script tag
    - Implement `app/page.tsx` as the universal download page: URL input, platform auto-detection, metadata display, format/quality selector, progress bar, and download trigger
    - Import `PLATFORM_REGISTRY` from `frontend/lib/platformRegistry.ts` for client-side validation
    - _Requirements: 1.3, 10.1, 10.2_

  - [x] 17.2 Implement dynamic platform pages (`frontend/app/[platform]/page.tsx`)
    - Generate static params from `PLATFORM_REGISTRY` keys for all 11 platforms
    - Each page renders the platform name, logo, accepted URL formats, and platform-specific options from `PlatformConfig`
    - Reuse the same URL input, metadata, format selector, and progress components as the universal page
    - Return 404 for unrecognised platform slugs
    - _Requirements: 1.1, 1.2, 1.4_

- [ ] 18. Frontend — shared UI components
  - [x] 18.1 Implement `frontend/components/UrlInput.tsx`
    - Controlled input with `onChange` debounce (100 ms) calling `validateUrl` from `frontend/lib/urlValidator.ts`
    - Display inline validation error within 100 ms of input change (no server round-trip)
    - Show platform logo and name when a valid URL is detected
    - _Requirements: 2.1, 2.2_

  - [x] 18.2 Implement `frontend/components/MediaPreview.tsx`
    - Display thumbnail, title, duration, and uploader name from `MediaInfo`
    - Show a loading skeleton while metadata is being fetched
    - Show descriptive error state when metadata fetch fails
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 18.3 Implement `frontend/components/FormatSelector.tsx`
    - Render all `FormatOption` items as selectable options
    - Pre-select highest quality MP4 by default
    - Update estimated file size display within 200 ms on selection change
    - Show audio-only option when `isAudioOnly` formats are present
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 18.4 Implement `frontend/components/ProgressBar.tsx`
    - Open SSE connection to `GET /api/jobs/:jobId/progress` after job creation
    - Render animated progress bar with percentage, ETA, and speed
    - Transition to "complete" state and trigger file download (`window.location` or `<a>` click) on `stage === 'complete'`
    - Transition to error state with retry button on `stage === 'error'`
    - _Requirements: 5.2, 5.3, 5.5_

  - [x] 18.5 Implement `frontend/components/TurnstileWidget.tsx`
    - Embed Cloudflare Turnstile in invisible mode using `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
    - Expose `getToken(): Promise<string>` method via `useImperativeHandle` or callback ref
    - Read site key from environment variable; never hardcode it
    - _Requirements: 14.1, 14.5, 14.6_

- [ ] 19. Frontend — platform-specific option components
  - [x] 19.1 Implement YouTube subtitle selector
    - Render subtitle language dropdown when `MediaInfo.subtitles` is non-empty
    - Allow selection of subtitle format (`srt` or `vtt`)
    - Pass `subtitleLang` and `subtitleFormat` in the download request options
    - _Requirements: 6.2_

  - [x] 19.2 Implement TikTok watermark toggle
    - Render a toggle for "Remove watermark" on the `/tiktok` platform page
    - Pass `noWatermark: true/false` in the download request options
    - _Requirements: 8.1_

  - [x] 19.3 Implement Instagram multi-media selector
    - When `MediaInfo` contains multiple items (carousel post), render all items and allow the user to select which to download
    - _Requirements: 7.2_

- [ ] 20. Frontend — property-based test for collection rendering
  - [ ]* 20.1 Write property test — Property 14: Collection completeness in rendering
    - **Property 14: Collection completeness in rendering**
    - **Validates: Requirements 4.1, 6.2, 7.2**
    - Use `fc.array(fc.record({ formatId: fc.string(), label: fc.string() }), { minLength: 0, maxLength: 50 })` to generate format/subtitle/media-item collections; render `FormatSelector` and assert the rendered output contains exactly N selectable elements — no items dropped or duplicated

- [x] 21. Nginx configuration
  - Create `nginx/dl.evarein.com.conf` with the full server block from the design:
    - TLS on port 443, HTTP→HTTPS redirect on port 80
    - `/api/*` proxied to Fastify `:3001`
    - `/api/jobs/*/progress` with `proxy_buffering off` and `proxy_read_timeout 3600s`
    - `/api/jobs/*/file` with `proxy_buffering off` and extended timeouts
    - `/health` proxied to Fastify `:3001`
    - `/*` proxied to Next.js `:3000` with WebSocket upgrade headers
    - Security headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`) added for Next.js responses
  - _Requirements: 5.2, 13.3_

- [x] 22. PM2 process configuration
  - Create `ecosystem.config.js` at the project root configuring two apps:
    - `frontend`: `npm run start` in `frontend/`, port 3000, `NODE_ENV=production`
    - `backend`: `node dist/server.js` in `backend/`, port 3001, `NODE_ENV=production`
  - Add `npm run build` scripts to both `package.json` files
  - _Requirements: 15.1_

- [ ] 23. End-to-end tests (Playwright)
  - [x] 23.1 Set up Playwright in `frontend/` with `@playwright/test`
    - Configure `playwright.config.ts` targeting `http://localhost:3000`
    - _Requirements: 2.1, 5.1, 5.2_

  - [ ]* 23.2 Write E2E test — happy path
    - Paste a valid URL → see metadata → select format → initiate download → verify file download triggered
    - _Requirements: 3.2, 4.1, 5.3_

  - [ ]* 23.3 Write E2E test — unsupported URL error path
    - Paste an unsupported URL → verify inline error appears within 100 ms without a server request
    - _Requirements: 2.2_

  - [ ]* 23.4 Write E2E test — rate limit message
    - Trigger HTTP 429 from the backend → verify user-friendly rate-limit message is displayed
    - _Requirements: 11.2_

- [x] 24. Final checkpoint — all tests pass
  - Run `vitest --run` in `backend/` — all unit, property, and integration tests must pass
  - Run `vitest --run` in `frontend/` — all component and property tests must pass
  - Run `npx playwright test --reporter=list` in `frontend/` — all E2E tests must pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 7, 16, 24) ensure incremental validation at key milestones
- Property tests use fast-check with `{ numRuns: 100 }` minimum; each is tagged with its property number and the requirements clause it validates
- Unit tests and property tests are complementary — both are included where applicable
- The URL validator and platform registry are duplicated into both `frontend/lib/` and `backend/src/lib/` (no shared package); keep them in sync manually or via a copy script
- `shell: false` is set explicitly on every `child_process.spawn` call even though it is the default, for clarity and auditability
- The `CF-Connecting-IP` header is used for all IP-based logic; `req.ip` is the fallback for local development only
