#!/usr/bin/env bash
# deploy.sh — run locally to push Nettu scheduler to your DigitalOcean droplet
#
# Usage:
#   DROPLET_IP=<your.droplet.ip> DROPLET_USER=root bash deploy.sh
#
# Prerequisites on the droplet: Docker + Docker Compose plugin installed.
#   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
#   sudo systemctl enable --now docker

set -euo pipefail

DROPLET_IP="${DROPLET_IP:-139.59.34.211}"
DROPLET_USER="${DROPLET_USER:-root}"
REMOTE_DIR="/opt/nettu-scheduler"

echo "==> Copying files to ${DROPLET_USER}@${DROPLET_IP}:${REMOTE_DIR}"
ssh "${DROPLET_USER}@${DROPLET_IP}" "mkdir -p ${REMOTE_DIR}"
scp "$(dirname "$0")/docker-compose.yml"      \
    "$(dirname "$0")/.env.example"            \
    "$(dirname "$0")/nginx-scheduler.conf"    \
    "${DROPLET_USER}@${DROPLET_IP}:${REMOTE_DIR}/"

echo ""
echo "==> Files copied. Now SSH into the droplet and complete the setup:"
echo ""
echo "  ssh ${DROPLET_USER}@${DROPLET_IP}"
echo ""
echo "  # 1. Create the .env file from the example"
echo "  cd ${REMOTE_DIR}"
echo "  cp .env.example .env"
echo "  nano .env          # fill in NETTU_API_KEY and NETTU_DB_PASSWORD"
echo ""
echo "  # 2. Start the stack as a named project (keeps it isolated from any"
echo "  #    other docker-compose stacks already running on this droplet)"
echo "  docker compose -p nettu --env-file .env up -d"
echo ""
echo "  # 3. Verify it is running"
echo "  docker compose -p nettu ps"
echo "  curl -s http://127.0.0.1:5000/api/v1/health || echo 'no health endpoint'"
echo ""
echo "  # 4. Add the Nginx config (replace scheduler.yourdomain.com with your subdomain)"
echo "  sudo cp ${REMOTE_DIR}/nginx-scheduler.conf /etc/nginx/sites-available/scheduler.yourdomain.com"
echo "  sudo ln -sf /etc/nginx/sites-available/scheduler.yourdomain.com \\"
echo "              /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  # 5. Issue a TLS certificate (Certbot must already be installed)"
echo "  sudo certbot --nginx -d scheduler.yourdomain.com"
echo ""
echo "==> Done. Set these env vars in your ScheduRX app (wherever it is deployed):"
echo "  NETTU_SCHEDULER_URL=https://scheduler.yourdomain.com"
echo "  NETTU_ACCOUNT_API_KEY=<the NETTU_API_KEY value you put in .env>"
