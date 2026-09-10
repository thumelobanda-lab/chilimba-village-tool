#!/usr/bin/env bash
# Applies one file from worker/schema/migrations/ to a deployed D1
# database and records it in the schema_migrations ledger table (see
# scripts/check-migrations.sh) so pending migrations can't quietly sit
# unapplied the way 017_payment_interval.sql did for two weeks — broken
# schedule saves in production, unnoticed until a user hit them.
#
# Usage:
#   scripts/apply-migration.sh worker/schema/migrations/019_foo.sql
#   scripts/apply-migration.sh worker/schema/migrations/019_foo.sql --env staging
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-migration.sql> [--env staging]" >&2
  exit 1
fi

FILE="$1"
DB_NAME="chilimba-db"
ENV_ARGS=()
if [ "${2:-}" = "--env" ] && [ "${3:-}" = "staging" ]; then
  DB_NAME="chilimba-db-staging"
  ENV_ARGS=(--env staging)
fi

# Resolve to an absolute path before we cd into worker/ below.
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
NAME="$(basename "$FILE")"

cd "$(dirname "$0")/../worker"

echo "==> Applying $NAME to $DB_NAME"
npx wrangler d1 execute "$DB_NAME" --remote "${ENV_ARGS[@]}" --file="$FILE"

echo "==> Recording $NAME in schema_migrations on $DB_NAME"
npx wrangler d1 execute "$DB_NAME" --remote "${ENV_ARGS[@]}" --command \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now'))); INSERT OR IGNORE INTO schema_migrations (filename) VALUES ('$NAME');"

echo "✓ $NAME applied and recorded on $DB_NAME."
