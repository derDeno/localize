#!/bin/sh
set -eu

LOCKFILE="package-lock.json"
STAMP_FILE="node_modules/.package-lock.sha256"

if [ ! -f "$LOCKFILE" ]; then
  echo "Missing $LOCKFILE, cannot start live container."
  exit 1
fi

CURRENT_SUM="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
SAVED_SUM=""

if [ -f "$STAMP_FILE" ]; then
  SAVED_SUM="$(cat "$STAMP_FILE")"
fi

if [ ! -d node_modules ] || [ "$CURRENT_SUM" != "$SAVED_SUM" ]; then
  echo "Dependencies changed, running npm ci..."
  npm ci
  mkdir -p node_modules
  printf '%s\n' "$CURRENT_SUM" > "$STAMP_FILE"
fi

exec npm run dev
