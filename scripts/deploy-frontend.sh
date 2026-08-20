#!/usr/bin/env bash
# Points the frontend at the deployed Worker, builds it, deploys to
# Cloudflare Pages, then patches the Worker's CORS setting to match and
# redeploys it. Run after ./scripts/deploy-backend.sh, from the project
# root: ./scripts/deploy-frontend.sh
set -euo pipefail

STATE_FILE=".deploy-state"
PROJECT_NAME="${PAGES_PROJECT_NAME:-chilimba-village-tool}"

if [ ! -f "$STATE_FILE" ]; then
  echo "No .deploy-state found — run ./scripts/deploy-backend.sh first."
  exit 1
fi

WORKER_URL=$(grep '^worker_url=' "$STATE_FILE" | cut -d= -f2)
VAPID_PUBLIC=$(grep '^vapid_public=' "$STATE_FILE" | cut -d= -f2 || true)

if [ -z "$WORKER_URL" ]; then
  echo "Worker URL not found in .deploy-state. Enter it manually:"
  read -r WORKER_URL
fi

echo "==> Writing .env"
{
  echo "VITE_API_BASE=${WORKER_URL}"
  [ -n "$VAPID_PUBLIC" ] && echo "VITE_VAPID_PUBLIC_KEY=${VAPID_PUBLIC}"
} > .env
cat .env

echo "==> Switching src/lib/api/core.js out of mock mode"
sed -i.bak "s/export const MOCK_MODE = true;/export const MOCK_MODE = false;/" src/lib/api/core.js
rm -f src/lib/api/core.js.bak

echo "==> Building"
npm run build

echo "==> Deploying to Cloudflare Pages (project: ${PROJECT_NAME})"
npx wrangler pages deploy dist --project-name="${PROJECT_NAME}"

# wrangler only prints the per-deployment hash URL (e.g.
# https://<hash>.<project>.pages.dev), which changes on every deploy —
# not the stable production alias. Cloudflare Pages always serves
# production from https://<project-name>.pages.dev, so build that
# directly rather than parsing it out of the deploy output.
PAGES_URL="https://${PROJECT_NAME}.pages.dev"

echo "==> Updating Worker CORS to allow ${PAGES_URL}"
sed -i.bak "s#ALLOWED_ORIGIN = \".*\"#ALLOWED_ORIGIN = \"${PAGES_URL}\"#" worker/wrangler.toml
rm -f worker/wrangler.toml.bak
(cd worker && npx wrangler deploy)

echo
echo "==> Done."
echo "App URL:    ${PAGES_URL}"
echo "Worker URL: ${WORKER_URL}"
echo
echo "Next: after your admins have logged in once, run:"
echo "  ./scripts/set-admin.sh <their-name>"
