# Video Downloader — Project Steering

## What This Project Is

A production-grade, self-hosted web tool for downloading videos from social media platforms (YouTube, Instagram, TikTok, X/Twitter, Facebook, Reddit, Vimeo, Twitch, Pinterest, LinkedIn, Dailymotion). Deployed at `dl.evarein.com`. No ads, no login, no signup — paste a URL and download.

## Spec Location

All spec documents live in `.kiro/specs/video-downloader/`:
- `requirements.md` — full requirements with acceptance criteria
- `design.md` — technical design, architecture, data models, API contracts
- `tasks.md` — ordered implementation task list (check this for current progress)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS — port 3000 |
| Backend | Node.js, Fastify — port 3001 |
| Extraction | yt-dlp (Python binary, called via `child_process.spawn`) |
| Job queue | Bull + Redis (existing Redis instance on VPS) |
| Bot protection | Cloudflare Turnstile (invisible mode, server-side verified) |
| Progress streaming | Server-Sent Events (SSE) |
| Reverse proxy | Nginx (existing, on VPS) |
| Process manager | PM2 |
| Testing | Vitest (unit + integration), fast-check (property-based), Playwright (E2E) |

## Project Structure

```
video-downloader/
├── frontend/        # Next.js app (port 3000)
├── backend/         # Fastify API server (port 3001)
└── nginx/           # Nginx server block config
```

## Deployment Environment

- VPS with Nginx, Redis, and PostgreSQL already running
- Domain `evarein.com` hosted on Cloudflare (proxy enabled)
- This tool deploys to subdomain `dl.evarein.com`
- Real client IP comes from `CF-Connecting-IP` header (not `req.ip`)

## Key Architecture Decisions

- **No authentication** — publicly accessible, protected by Turnstile + rate limiting only
- **Turnstile** gates `POST /api/download` only; `POST /api/info` (metadata) is open
- **yt-dlp** always called with `shell: false` and argument arrays — never string interpolation
- **Platform registry** (`backend/src/platforms/registry.ts`) is the single place to add new platforms — no changes to routing or download logic needed
- **URL validator** is duplicated into both `frontend/lib/urlValidator.ts` (client-safe, no DNS) and `backend/src/lib/urlValidator.ts` (includes SSRF guard)
- **Temp files** stored in `/tmp/vd-jobs/{jobId}/`, deleted within 60s of delivery or on job failure
- **SSE** used for real-time download progress (`GET /api/jobs/:jobId/progress`)
- **Nginx** routes `/api/*` → Fastify `:3001`, everything else → Next.js `:3000`

## API Contracts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/info` | None | Fetch video metadata (title, thumbnail, formats) |
| POST | `/api/download` | Turnstile token | Create download job, returns `{ jobId }` |
| GET | `/api/jobs/:id/progress` | None | SSE stream of job progress |
| GET | `/api/jobs/:id/file` | None | Stream completed file to browser |
| GET | `/health` | None | Health check, returns `{ status: "ok" }` |

## Environment Variables

### Backend (`backend/.env`)
```
REDIS_URL=                    # required
TURNSTILE_SECRET_KEY=         # required
PORT=3001
TEMP_DIR=/tmp/vd-jobs
MAX_CONCURRENT_JOBS=3
YTDLP_PATH=yt-dlp
YOUTUBE_COOKIES_FILE=         # optional, for age-restricted content
RATE_LIMIT_INFO_RPM=20
RATE_LIMIT_MAX_CONCURRENT=5
```

### Frontend (`frontend/.env`)
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=   # required
```

## Supported Platforms

youtube, instagram, tiktok, twitter (x.com), facebook, reddit, vimeo, twitch, pinterest, linkedin, dailymotion

## Platform-Specific Features

- **YouTube** — up to 4K, subtitle download (.srt/.vtt), Shorts URLs, age-restricted handling
- **Instagram** — Reels, multi-media carousel posts, Stories
- **TikTok** — watermark toggle, shortened `vm.tiktok.com` URLs
- **X/Twitter** — multi-quality variants, both `twitter.com` and `x.com` URLs

## How to Check Progress

Open `tasks.md`. Tasks use this format:
- `- [ ]` = not started
- `- [-]` = in progress
- `- [x]` = completed
- `- [ ]*` = optional task (can be skipped)

Pick up from the first `- [ ]` task that isn't completed.

## How to Continue Work

1. Read `tasks.md` to find the next incomplete task
2. Read `design.md` for the relevant component's interface and data models
3. Read `requirements.md` for the acceptance criteria the task must satisfy
4. Implement, then run tests before marking the task complete

## Commands

```bash
# Backend
cd backend && npm install
npm run dev          # development
npm run build        # compile TypeScript
npm run test         # vitest --run

# Frontend
cd frontend && npm install
npm run dev          # development (port 3000)
npm run build        # next build
npm run test         # vitest --run
npx playwright test  # E2E tests

# Production (PM2)
pm2 start ecosystem.config.js
pm2 logs
pm2 status
```

## Security Rules (Never Violate)

1. Never call `child_process.exec` or `spawn` with `shell: true` for yt-dlp
2. Never forward raw yt-dlp stderr to the client
3. Never hardcode Turnstile keys, Redis URLs, or credentials — always use env vars
4. Always read client IP from `CF-Connecting-IP`, not `req.ip`, in production
5. Always validate and SSRF-check URLs server-side before passing to yt-dlp
6. Always delete temp files within 60s of delivery
