#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────
APP_DIR="/var/www/video-downloader"
PM2_HOME="/var/www/.pm2"
APP_USER="www-data"
YTDLP_SRC="/root/.local/bin/yt-dlp"
YTDLP_DEST="/usr/local/bin/yt-dlp"
NGINX_SRC="$APP_DIR/nginx/dl.evarein.com.conf"
NGINX_DEST="/etc/nginx/sites-available/dl.evarein.com"

# ── Colors ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
fail() { echo -e "${RED}[deploy]${NC} $1"; exit 1; }

# ── Must run as root ──────────────────────────────────────────────────
if [[ $(id -u) -ne 0 ]]; then
  fail "Run as root: sudo bash deploy.sh"
fi

# ── Pull latest code ─────────────────────────────────────────────────
log "Pulling latest code..."
cd "$APP_DIR"
git pull

# ── Update yt-dlp ────────────────────────────────────────────────────
if [[ -f "$YTDLP_SRC" ]]; then
  log "Updating yt-dlp..."
  cp "$YTDLP_SRC" "$YTDLP_DEST"
  chmod 755 "$YTDLP_DEST"
else
  warn "yt-dlp not found at $YTDLP_SRC — skipping"
fi

# ── Backend ──────────────────────────────────────────────────────────
log "Backend: clean install..."
cd "$APP_DIR/backend"
rm -rf node_modules dist
npm ci

log "Backend: building..."
npx tsc

# ── Frontend ─────────────────────────────────────────────────────────
log "Frontend: clean install..."
cd "$APP_DIR/frontend"
rm -rf node_modules .next
npm ci

log "Frontend: building..."
npx next build

# ── Permissions ──────────────────────────────────────────────────────
log "Setting ownership..."
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/backend/.env" 2>/dev/null || true
chmod 600 "$APP_DIR/frontend/.env" 2>/dev/null || true

mkdir -p /tmp/vd-jobs
chown "$APP_USER:$APP_USER" /tmp/vd-jobs
chmod 750 /tmp/vd-jobs

mkdir -p "$PM2_HOME"
chown "$APP_USER:$APP_USER" "$PM2_HOME"

# ── Nginx ────────────────────────────────────────────────────────────
if [[ -f "$NGINX_SRC" ]]; then
  log "Updating Nginx config..."
  cp "$NGINX_SRC" "$NGINX_DEST"
  ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/dl.evarein.com

  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "Nginx reloaded."
  else
    fail "Nginx config test failed — not reloading."
  fi
fi

# ── PM2 ──────────────────────────────────────────────────────────────
log "Restarting services..."
sudo -u "$APP_USER" PM2_HOME="$PM2_HOME" pm2 delete all 2>/dev/null || true
sudo -u "$APP_USER" PM2_HOME="$PM2_HOME" PATH="/usr/local/bin:$PATH" pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u "$APP_USER" PM2_HOME="$PM2_HOME" pm2 save

# ── Verify ───────────────────────────────────────────────────────────
log "Waiting for services to start..."
sleep 8

OK=true
if ss -tlnp | grep -q ':3001'; then
  log "Backend  :3001 ✓"
else
  warn "Backend  :3001 ✗"
  OK=false
fi

if ss -tlnp | grep -q ':3000'; then
  log "Frontend :3000 ✓"
else
  warn "Frontend :3000 ✗"
  OK=false
fi

echo ""
if $OK; then
  log "Deploy complete — https://dl.evarein.com is live."
else
  warn "Issues detected. Check: sudo -u $APP_USER PM2_HOME=$PM2_HOME pm2 logs"
fi
