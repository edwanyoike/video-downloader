# Video Downloader — VPS Deployment Guide

Deploys the video downloader to `dl.evarein.com` on your existing VPS with Nginx, Redis, and Cloudflare.

## Prerequisites

- Ubuntu/Debian VPS with root or sudo access
- Node.js 18+ installed
- Redis running on the VPS
- Nginx installed
- Domain `evarein.com` managed by Cloudflare (proxy enabled)
- PM2 installed globally (`npm install -g pm2`)

---

## Step 1: Install System Dependencies

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install ffmpeg (required for merging video + audio streams)
sudo apt install -y ffmpeg python3-pip

# Install yt-dlp
pip install -U yt-dlp

# Verify installations
yt-dlp --version
ffmpeg -version
node --version    # should be 18+
redis-cli ping    # should return PONG

# Note the yt-dlp path for later
which yt-dlp
# Usually: /usr/local/bin/yt-dlp or ~/.local/bin/yt-dlp
```

---

## Step 2: Upload Project to VPS

```bash
# Create project directory
sudo mkdir -p /var/www/video-downloader
sudo chown $USER:$USER /var/www/video-downloader

# Option A: Git clone
cd /var/www
git clone <your-repo-url> video-downloader

# Option B: SCP from local machine
scp -r ./backend ./frontend ./nginx ./ecosystem.config.js user@your-vps:/var/www/video-downloader/
```

Verify the structure:
```bash
ls /var/www/video-downloader/
# Should show: backend/  frontend/  nginx/  ecosystem.config.js
```

---

## Step 3: Set Up Cloudflare Turnstile

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Turnstile**
2. Click **Add site**
3. Fill in:
   - Site name: `Video Downloader`
   - Domain: `dl.evarein.com`
   - Widget type: **Invisible**
4. Click **Create**
5. Copy the **Site Key** (starts with `0x4AAAAAAA...`) — needed for frontend
6. Copy the **Secret Key** (starts with `0x4AAAAAAA...`) — needed for backend

---

## Step 4: Set Up DNS in Cloudflare

1. Go to Cloudflare Dashboard → `evarein.com` → **DNS**
2. Add a new record:
   - Type: `A`
   - Name: `dl`
   - Content: `<your VPS IP address>`
   - Proxy status: **Proxied** (orange cloud ON)
   - TTL: Auto
3. Wait a few minutes for propagation

---

## Step 5: Set Up SSL Certificate

Since the domain is on Cloudflare, use a Cloudflare Origin Certificate:

1. Go to Cloudflare Dashboard → `evarein.com` → **SSL/TLS** → **Origin Server**
2. Click **Create Certificate**
3. Settings:
   - Private key type: RSA (2048)
   - Hostnames: `dl.evarein.com`
   - Certificate validity: 15 years
4. Click **Create**
5. Copy the **Origin Certificate** and **Private Key**

Save them on your VPS:
```bash
sudo mkdir -p /etc/ssl/cloudflare

# Paste the Origin Certificate
sudo nano /etc/ssl/cloudflare/dl.evarein.com.pem

# Paste the Private Key
sudo nano /etc/ssl/cloudflare/dl.evarein.com.key

# Secure the key file
sudo chmod 600 /etc/ssl/cloudflare/dl.evarein.com.key
```

Set Cloudflare SSL mode:
1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**

---

## Step 6: Configure and Install Backend

```bash
cd /var/www/video-downloader/backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env
```

Edit `backend/.env` with your actual values:
```env
REDIS_URL=redis://localhost:6379
TURNSTILE_SECRET_KEY=0x4AAAAAAA_YOUR_SECRET_KEY_HERE
PORT=3001
TEMP_DIR=/tmp/vd-jobs
MAX_CONCURRENT_JOBS=3
YTDLP_PATH=/usr/local/bin/yt-dlp
YOUTUBE_COOKIES_FILE=
RATE_LIMIT_INFO_RPM=20
RATE_LIMIT_MAX_CONCURRENT=5
```

> Replace `TURNSTILE_SECRET_KEY` with the secret key from Step 3.
> Replace `YTDLP_PATH` with the output of `which yt-dlp`.

Build the TypeScript:
```bash
npm run build

# Verify the build
ls dist/server.js
```

---

## Step 7: Configure and Install Frontend

```bash
cd /var/www/video-downloader/frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env
```

Edit `frontend/.env`:
```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA_YOUR_SITE_KEY_HERE
NEXT_PUBLIC_API_BASE=
```

> Replace `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the site key from Step 3.
> Leave `NEXT_PUBLIC_API_BASE` empty — the frontend calls `/api/*` on the same origin, which Nginx proxies to the backend.

Build Next.js:
```bash
npm run build
```

---

## Step 8: Create Temp Directory

```bash
sudo mkdir -p /tmp/vd-jobs

# Set ownership to the user that runs Node processes
sudo chown $USER:$USER /tmp/vd-jobs
```

---

## Step 9: Configure Nginx

```bash
# Copy the config file
sudo cp /var/www/video-downloader/nginx/dl.evarein.com.conf /etc/nginx/sites-available/dl.evarein.com

# Update SSL certificate paths to match Step 5
sudo nano /etc/nginx/sites-available/dl.evarein.com
```

Update these two lines in the config:
```nginx
ssl_certificate     /etc/ssl/cloudflare/dl.evarein.com.pem;
ssl_certificate_key /etc/ssl/cloudflare/dl.evarein.com.key;
```

Enable the site and test:
```bash
# Create symlink to enable
sudo ln -s /etc/nginx/sites-available/dl.evarein.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## Step 10: Start with PM2

```bash
cd /var/www/video-downloader

# Start both frontend and backend
pm2 start ecosystem.config.js

# Verify both are running
pm2 status
```

Expected output:
```
┌─────┬──────────────┬─────────────┬──────┬───────┐
│ id  │ name         │ status      │ cpu  │ mem   │
├─────┼──────────────┼─────────────┼──────┼───────┤
│ 0   │ vd-frontend  │ online      │ 0%   │ 80MB  │
│ 1   │ vd-backend   │ online      │ 0%   │ 50MB  │
└─────┴──────────────┴─────────────┴──────┴───────┘
```

Check logs for any startup errors:
```bash
pm2 logs --lines 30
```

Set PM2 to survive reboots:
```bash
pm2 save
pm2 startup
# Run the command it outputs (starts with sudo env PATH=...)
```

---

## Step 11: Verify Deployment

```bash
# 1. Health check (from VPS)
curl http://localhost:3001/health
# Expected: {"status":"ok","queue":{"waiting":0,"active":0}}

# 2. Frontend loads (from VPS)
curl -I http://localhost:3000
# Expected: HTTP/1.1 200 OK

# 3. Full stack via domain (from any machine)
curl https://dl.evarein.com/health
# Expected: {"status":"ok","queue":{"waiting":0,"active":0}}

# 4. Open in browser
# Visit https://dl.evarein.com
# You should see the Video Downloader homepage
```

---

## Step 12: Set Up Auto-Update for yt-dlp

yt-dlp needs regular updates as platforms change their APIs:

```bash
# Add a weekly cron job (Sundays at 3 AM)
crontab -e
```

Add this line:
```cron
0 3 * * 0 /usr/local/bin/pip install -U yt-dlp && /usr/local/bin/pm2 restart vd-backend >> /var/log/ytdlp-update.log 2>&1
```

> Adjust the `pip` and `pm2` paths based on your system. Find them with `which pip` and `which pm2`.

---

## Common PM2 Commands

```bash
pm2 status                # Check process status
pm2 logs                  # Tail all logs
pm2 logs vd-backend       # Tail backend logs only
pm2 logs vd-frontend      # Tail frontend logs only
pm2 restart all           # Restart both processes
pm2 restart vd-backend    # Restart backend only
pm2 reload all            # Zero-downtime reload
pm2 stop all              # Stop everything
pm2 delete all            # Remove all processes
pm2 monit                 # Real-time monitoring dashboard
pm2 flush                 # Clear all log files
```

---

## Updating the Application

When you push code changes:

```bash
cd /var/www/video-downloader

# Pull latest code
git pull

# Rebuild backend
cd backend
npm install
npm run build

# Rebuild frontend
cd ../frontend
npm install
npm run build

# Restart both processes
pm2 restart all
```

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs vd-backend --lines 50
```
Common causes:
- Missing env vars → check `backend/.env`
- Redis not running → `redis-cli ping`
- Port 3001 already in use → `lsof -i :3001`

### Frontend won't start
```bash
pm2 logs vd-frontend --lines 50
```
Common causes:
- Build not run → `cd frontend && npm run build`
- Port 3000 already in use → `lsof -i :3000`

### Downloads fail
```bash
# Test yt-dlp directly
yt-dlp --dump-json "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```
Common causes:
- yt-dlp outdated → `pip install -U yt-dlp`
- ffmpeg not installed → `apt install ffmpeg`
- Temp directory permissions → `chown $USER:$USER /tmp/vd-jobs`

### 502 Bad Gateway
- Backend or frontend not running → `pm2 status`
- Nginx config error → `nginx -t`
- Wrong ports in Nginx config → verify 3000 and 3001

### Turnstile errors (403 on download)
- Wrong secret key in `backend/.env`
- Wrong site key in `frontend/.env`
- Domain mismatch in Cloudflare Turnstile settings
- Cloudflare proxy not enabled (orange cloud must be ON)

### Rate limit issues (429)
```bash
# Check current rate limit settings
grep RATE_LIMIT backend/.env

# Clear rate limit data in Redis
redis-cli KEYS "vd:*"
redis-cli DEL <key>
```

---

## Architecture Reference

```
Internet
   │
   ▼
Cloudflare (proxy + Turnstile + DDoS)
   │
   ▼
Nginx (dl.evarein.com:443)
   ├── /api/*           → Fastify :3001
   ├── /health          → Fastify :3001
   └── /*               → Next.js :3000

Fastify :3001
   ├── Bull Queue       → Redis :6379
   ├── Rate Limiter     → Redis :6379
   └── yt-dlp           → /tmp/vd-jobs/{jobId}/
```

---

## Security Checklist

- [ ] `backend/.env` has correct `TURNSTILE_SECRET_KEY`
- [ ] `frontend/.env` has correct `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] Cloudflare proxy is enabled (orange cloud ON)
- [ ] Cloudflare SSL mode is set to **Full (strict)**
- [ ] Nginx SSL certificate paths are correct
- [ ] `/tmp/vd-jobs` has correct ownership
- [ ] Redis is not exposed to the internet (bind to 127.0.0.1)
- [ ] yt-dlp cron job is set up for auto-updates
- [ ] PM2 startup is configured for reboots
