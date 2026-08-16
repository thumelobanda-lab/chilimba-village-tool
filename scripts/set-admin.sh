#!/usr/bin/env bash
# Promotes a member to admin. They must have logged into the app at
# least once already (so their row exists in the users table).
# Usage: ./scripts/set-admin.sh harriet
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: ./scripts/set-admin.sh <name>"
  exit 1
fi

NAME_LOWER=$(echo "$1" | tr '[:upper:]' '[:lower:]')

(cd worker && npx wrangler d1 execute chilimba-db --remote \
  --command "UPDATE users SET role='admin' WHERE name='${NAME_LOWER}';")

echo "Done. ${1} is now an admin (they may need to log out and back in to see the Group Setup / Reconciliation tabs)."
