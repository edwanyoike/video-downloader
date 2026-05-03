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
if [[ $EUID -ne 0 ]]; then
  fail "Run as root: sudo ./deploy.sh"
fi

# ── Pull latest code ─────────────────────────────────────────────────
log "Pulling latest code..."
cd "$APP_DIR"
git pull

# ── Update yt-dlp ────────────────────────────────────────────────────
if [[ -f "$YTDLP_SRC" ]]; then
  log "Copying yt-dlp to $YTDLP_DEST..."
  cp "$YTDLP_SRC" "$YTDLP_DEST"
  chmod 755 "$YTDLP_DEST"
else
  warn "yt-dlp not found at $YTDLP_SRC — skipping copy"
fi

# ── Backend ──────────────────────────────────────────────────────────
log "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install

log "Building backend..."
npm run build

# ── Frontend ─────────────────────────────────────────────────────────
log "Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install

log "Building frontend..."
npm run build

# ── Permissions ──────────────────────────────────────────────────────
log "Setting ownership to $APP_USER..."
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Protect .env files
chmod 600 "$APP_DIR/backend/.env" 2>/dev/null || true
chmod 600 "$APP_DIR/frontend/.env" 2>/dev/null || true

# Temp directory
mkdir -p /tmp/vd-jobs
chown "$APP_USER:$APP_USER" /tmp/vd-jobs
chmod 750 /tmp/vd-jobs

# PM2 home
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

# ── PM2 restart ──────────────────────────────────────────────────────
log "Restarting PM2 processes..."
export PM2_HOME="$PM2_HOME"

sudo -u "$APP_USER" PM2_HOME="$PM2_HOME" pm2 delete all 2>/dev/null || true
sudo -u "$APP_USER" PM2_HOME="$PM2_HOME" pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u "$APP_USER" PM2_HOME="$PM2_HOME" pm2 save

# ── Verify ───────────────────────────────────────────────────────────
sleep 3

BACKEND_OK=false
FRONTEND_OK=false

if ss -tlnp | grep -q ':3001'; then
  BACKEND_OK=true
  log "Backend listening on :3001 ✓"
else
  warn "Backend NOT listening on :3001"
fi

if ss -tlnp | grep -q ':3000'; then
  FRONTEND_OK=true
  log "Frontend listening on :3000 ✓"
else
  warn "Frontend NOT listening on :3000"
fi

echo ""
if $BACKEND_OK && $FRONTEND_OK; then
  log "Deploy complete. Site is live at https://dl.evarein.com"
else
  warn "Deploy finished with issues. Check: sudo -u $APP_USER PM2_HOME=$PM2_HOME pm2 logs"
fi
