#!/usr/bin/env bash
# Creates the platform owner account directly in D1 — there's no HTTP
# endpoint that can do this (see worker/src/ownerAuth.js's header
# comment for why). Requires real Cloudflare account access via
# `wrangler` (already authenticated in this environment) — that's what
# actually gates who can ever become an owner, not a static secret that
# could leak.
#
# Usage: ./scripts/create-owner.sh <email>
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: ./scripts/create-owner.sh <email>"
  exit 1
fi

EMAIL="$1"
read -rsp "Owner password (min 12 characters, never echoed or logged): " PASSWORD
echo
if [ "${#PASSWORD}" -lt 12 ]; then
  echo "Password must be at least 12 characters." >&2
  exit 1
fi

OWNER_EMAIL="$EMAIL" OWNER_PASSWORD="$PASSWORD" node "$(dirname "$0")/create-owner.mjs"
