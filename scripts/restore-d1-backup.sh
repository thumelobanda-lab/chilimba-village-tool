#!/usr/bin/env bash
# Restores a D1 database from a backup produced by
# worker/src/backupWorkflow.js — a .sql export sitting in R2 under
# backups/<db-name>/<timestamp>-<filename>.sql.
#
# Usage:
#   ./scripts/restore-d1-backup.sh <backup-key> [--env staging]
#
# Example:
#   ./scripts/restore-d1-backup.sh \
#     backups/chilimba-db-staging/2026-09-11T02-30-00-000Z-export.sql \
#     --env staging
#
# List available backups first with:
#   cd worker && npx wrangler r2 object get <bucket>/<prefix> ...
# (there's no bucket-wide `list` in the wrangler CLI — see the R2
# dashboard, or worker/src/backupWorkflow.js's listAllBackups() if you
# need this scripted).
#
# WARNING — this DROPS every existing table in the target database and
# replaces it with the backup's contents. There is no undo except
# restoring a different backup. Never run this against production
# without a fresh backup of the CURRENT state first, so today's data
# isn't the thing you lose if the restore itself goes wrong.

set -euo pipefail

BACKUP_KEY="${1:?Usage: $0 <backup-key-in-r2> [--env staging]}"

TARGET_ENV="production"
if [ "${2:-}" = "--env" ]; then
  TARGET_ENV="${3:?Missing environment name after --env}"
fi

if [ "$TARGET_ENV" = "staging" ]; then
  BUCKET="chilimba-avatars-staging"
  DB_NAME="chilimba-db-staging"
  WRANGLER_ENV_FLAG="--env staging"
else
  BUCKET="chilimba-avatars"
  DB_NAME="chilimba-db"
  WRANGLER_ENV_FLAG=""
fi

cd "$(dirname "$0")/../worker"

TMP_SQL="$(mktemp /tmp/d1-restore-XXXXXX.sql)"
trap 'rm -f "$TMP_SQL"' EXIT

echo "==> Downloading ${BACKUP_KEY} from R2 bucket ${BUCKET}"
npx wrangler r2 object get "${BUCKET}/${BACKUP_KEY}" --file="$TMP_SQL" --remote

if [ ! -s "$TMP_SQL" ]; then
  echo "Downloaded file is empty — aborting before touching ${DB_NAME}."
  exit 1
fi

echo
echo "==> Target: ${DB_NAME} (${TARGET_ENV})"
echo "This will DROP every table in ${DB_NAME} and replace it with the backup's contents."
read -r -p "Type the database name (${DB_NAME}) to confirm: " CONFIRM
if [ "$CONFIRM" != "$DB_NAME" ]; then
  echo "Confirmation did not match — aborting. Nothing was changed."
  exit 1
fi

echo "==> Listing existing tables"
# shellcheck disable=SC2086
TABLES_JSON=$(npx wrangler d1 execute "$DB_NAME" $WRANGLER_ENV_FLAG --remote --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'")
TABLES=$(echo "$TABLES_JSON" | node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  const rows = JSON.parse(d)[0].results;
  console.log(rows.map(r => r.name).join(' '));
});
")

echo "==> Dropping: ${TABLES:-<none found>}"
# One file, one execution — NOT one `wrangler d1 execute --command` per
# table. Each separate `d1 execute` invocation is its own request/
# connection, so a `PRAGMA foreign_keys=OFF` set in one doesn't carry
# over to the next; dropping tables one connection at a time in
# sqlite_master's arbitrary listing order (not dependency order) then
# fails with FOREIGN KEY constraint errors the moment a still-referenced
# parent table is dropped before its children — hit exactly this
# restoring a real staging backup before this comment existed. Putting
# the pragma and every DROP in one file means they share one connection,
# so the pragma actually takes effect for all of them.
DROP_SQL="$(mktemp /tmp/d1-restore-drops-XXXXXX.sql)"
trap 'rm -f "$TMP_SQL" "$DROP_SQL"' EXIT
{
  echo "PRAGMA foreign_keys=OFF;"
  for T in $TABLES; do
    echo "DROP TABLE IF EXISTS \"$T\";"
  done
} > "$DROP_SQL"
# shellcheck disable=SC2086
npx wrangler d1 execute "$DB_NAME" $WRANGLER_ENV_FLAG --remote --file="$DROP_SQL"

echo "==> Restoring from backup"
# shellcheck disable=SC2086
npx wrangler d1 execute "$DB_NAME" $WRANGLER_ENV_FLAG --remote --file="$TMP_SQL"

echo
echo "==> Restore complete. Spot-check it, e.g.:"
echo "  cd worker && npx wrangler d1 execute $DB_NAME $WRANGLER_ENV_FLAG --remote --command \"SELECT COUNT(*) FROM users;\""
echo "  cd worker && npx wrangler d1 execute $DB_NAME $WRANGLER_ENV_FLAG --remote --command \"SELECT COUNT(*) FROM payments;\""
