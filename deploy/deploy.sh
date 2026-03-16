#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ── Load environment ──────────────────────────────
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found."
  echo "Copy .env.production.example to .env.production and fill in your values."
  exit 1
fi

set -a
source .env.production
set +a

: "${DOMAIN:?DOMAIN is required in .env.production}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL is required in .env.production}"

# ── Generate nginx.conf from template ─────────────
sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx.conf.template > deploy/nginx.conf
echo "Generated deploy/nginx.conf for domain: ${DOMAIN}"

# ── Build containers ──────────────────────────────
echo "Building Docker images..."
docker compose --env-file .env.production build

# ── Step 1: Start with HTTP-only for cert acquisition
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo "No SSL certificate found. Starting HTTP-only for certificate acquisition..."
  cp deploy/nginx-init.conf deploy/nginx.conf
  docker compose --env-file .env.production up -d nginx backend frontend

  echo "Requesting SSL certificate..."
  docker compose --env-file .env.production run --rm certbot certonly \
    --webroot -w /var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos --no-eff-email \
    -d "$DOMAIN"

  # Restore full HTTPS nginx config
  sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx.conf.template > deploy/nginx.conf
  docker compose --env-file .env.production down
fi

# ── Step 2: Start all services ────────────────────
echo "Starting all services..."
docker compose --env-file .env.production up -d

echo ""
echo "Deployment complete!"
echo "  Site:    https://${DOMAIN}"
echo "  Health:  https://${DOMAIN}/health"
echo ""
echo "To renew certificates, run:"
echo "  docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload"
