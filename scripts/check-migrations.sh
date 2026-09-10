#!/usr/bin/env bash
# Diffs worker/schema/migrations/*.sql against the schema_migrations
# ledger on a deployed D1 database and warns about anything in the repo
# that hasn't been recorded as applied there. Doesn't touch the schema —
# read-only. Run it any time you're not sure the live database matches
# the repo, or wire it in before a Worker deploy (see worker/package.json
# "predeploy").
#
# Usage:
#   scripts/check-migrations.sh              # checks production (chilimba-db)
#   scripts/check-migrations.sh --env staging # checks chilimba-db-staging
set -euo pipefail

DB_NAME="chilimba-db"
ENV_ARGS=()
if [ "${1:-}" = "--env" ] && [ "${2:-}" = "staging" ]; then
  DB_NAME="chilimba-db-staging"
  ENV_ARGS=(--env staging)
fi

cd "$(dirname "$0")/../worker"

npx wrangler d1 execute "$DB_NAME" --remote "${ENV_ARGS[@]}" --command \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));" \
  >/dev/null

APPLIED_JSON=$(npx wrangler d1 execute "$DB_NAME" --remote "${ENV_ARGS[@]}" --json --command \
  "SELECT filename FROM schema_migrations;")

APPLIED=$(node -e '
  const rows = JSON.parse(process.argv[1])[0].results;
  for (const r of rows) console.log(r.filename);
' "$APPLIED_JSON")

PENDING=()
for f in schema/migrations/*.sql; do
  name="$(basename "$f")"
  if ! grep -qxF "$name" <<< "$APPLIED"; then
    PENDING+=("$name")
  fi
done

if [ "${#PENDING[@]}" -gt 0 ]; then
  echo "⚠️  $DB_NAME is missing ${#PENDING[@]} migration(s) present in the repo:"
  printf '  - %s\n' "${PENDING[@]}"
  echo "Apply with: scripts/apply-migration.sh worker/schema/migrations/<file> $([ "$DB_NAME" = "chilimba-db-staging" ] && echo '--env staging')"
  exit 1
fi

echo "✓ $DB_NAME has every migration in worker/schema/migrations/ recorded as applied."
