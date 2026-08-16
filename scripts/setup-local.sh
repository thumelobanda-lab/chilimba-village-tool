#!/usr/bin/env bash
# Installs dependencies for both the frontend and the Worker.
# Run once, from the project root: ./scripts/setup-local.sh
set -euo pipefail

echo "==> Installing frontend dependencies"
npm install

echo "==> Installing Worker dependencies"
(cd worker && npm install)

echo
echo "Done. Start the dev server with: npm run dev"
