#!/usr/bin/env bash
# Provisions the Cloudflare backend: logs in, creates the D1 database,
# applies the schema, generates and sets VAPID push keys, and deploys
# the Worker. Run from the project root: ./scripts/deploy-backend.sh
#
# You'll still hit a couple of unavoidable interactive prompts (the
# Cloudflare login opens a browser tab), but everything else — copying
# IDs and keys into config files, running wrangler secret put — is
# handled for you.
set -euo pipefail

STATE_FILE=".deploy-state"
: > "$STATE_FILE"

cd worker

echo "==> Logging in to Cloudflare (opens a browser tab)"
npx wrangler login

echo "==> Creating D1 database"
if grep -q "REPLACE_AFTER_WRANGLER_D1_CREATE" wrangler.toml; then
  D1_OUTPUT=$(npx wrangler d1 create chilimba-db)
  echo "$D1_OUTPUT"
  DB_ID=$(echo "$D1_OUTPUT" | grep -oE 'database_id = "[^"]+"' | head -1 | cut -d'"' -f2)
  if [ -z "$DB_ID" ]; then
    echo "Could not auto-detect the database_id. Copy it from the output above"
    echo "into worker/wrangler.toml manually, then re-run this script."
    exit 1
  fi
  sed -i.bak "s/REPLACE_AFTER_WRANGLER_D1_CREATE/${DB_ID}/" wrangler.toml
  rm -f wrangler.toml.bak
  echo "database_id set to ${DB_ID}"
else
  echo "database_id already set in wrangler.toml — skipping creation."
fi

echo "==> Applying database schema"
npx wrangler d1 execute chilimba-db --file=./schema/schema.sql --remote

echo "==> Generating VAPID keys for push notifications"
VAPID_OUTPUT=$(npx --yes web-push generate-vapid-keys)
echo "$VAPID_OUTPUT"
VAPID_PUBLIC=$(echo "$VAPID_OUTPUT" | grep -A1 "Public Key" | tail -1 | tr -d '[:space:]')
VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | grep -A1 "Private Key" | tail -1 | tr -d '[:space:]')

if [ -n "$VAPID_PUBLIC" ] && [ -n "$VAPID_PRIVATE" ]; then
  sed -i.bak "s/REPLACE_WITH_GENERATED_VAPID_PUBLIC_KEY/${VAPID_PUBLIC}/" wrangler.toml
  rm -f wrangler.toml.bak
  echo "$VAPID_PRIVATE" | npx wrangler secret put VAPID_PRIVATE_KEY
  echo "vapid_public=${VAPID_PUBLIC}" >> "../$STATE_FILE"
else
  echo "Could not auto-parse VAPID keys — generate manually with:"
  echo "  npx web-push generate-vapid-keys"
fi

echo "==> Deploying the Worker"
DEPLOY_OUTPUT=$(npx wrangler deploy)
echo "$DEPLOY_OUTPUT"
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)
echo "worker_url=${WORKER_URL}" >> "../$STATE_FILE"

cd ..

echo
echo "==> Backend deployed."
echo "Worker URL: ${WORKER_URL:-<check output above>}"
echo
echo "Next: set your mobile money / SMS keys when you have accounts for them:"
echo "  cd worker && npx wrangler secret put MOMO_API_KEY"
echo "  cd worker && npx wrangler secret put SMS_API_KEY"
echo
echo "Then run: ./scripts/deploy-frontend.sh"
