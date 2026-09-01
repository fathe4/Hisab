#!/usr/bin/env bash
#
# Deploy Hisab to your Oracle Cloud VM.
#
# One-time setup (see DEPLOYMENT.md):
#   1. Create the VM, open ports 80/443, install Caddy
#   2. Add your SSH key and note the VM's public IP
#   3. Set the variables below (or export them in your shell)
#
# Usage:
#   ./deploy.sh                 # build + rsync to the server
#   DEPLOY_HOST=1.2.3.4 ./deploy.sh   # override per-run

set -euo pipefail

# ---- Config ----
DEPLOY_HOST="${DEPLOY_HOST:-}"          # e.g. 129.151.55.12
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/expense}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "❌  DEPLOY_HOST is not set."
  echo "   Usage: DEPLOY_HOST=<vm-public-ip> ./deploy.sh"
  echo "   (or edit the defaults at the top of this script)"
  exit 1
fi

SSH_CMD="ssh -i $SSH_KEY -o BatchMode=yes $DEPLOY_USER@$DEPLOY_HOST"

echo "🏗   Building production bundle…"
npm run build

echo "📦  Syncing dist/ → $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_DIR"
# --delete keeps the server clean of stale hashed assets
rsync -avz --delete -e "ssh -i $SSH_KEY" dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_DIR/"

echo "🔁  Fixing permissions on the server…"
$SSH_CMD "sudo mkdir -p $DEPLOY_DIR && sudo chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_DIR"

echo "✅  Deployed! Caddy serves the new files instantly — no restart needed."
