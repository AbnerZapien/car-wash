#!/bin/sh
set -eu

DB_PATH="${DB_PATH:-/app/db/main.db}"
DB_DIR="$(dirname "$DB_PATH")"

mkdir -p "$DB_DIR"

# Initialize DB if missing
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] initializing sqlite db at $DB_PATH"
  sqlite3 "$DB_PATH" < /app/db/schema.sql
  sqlite3 "$DB_PATH" < /app/db/seed.sql
fi

# Best-effort migrations (safe if columns already exist)
sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '';" 2>/dev/null || true
sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';" 2>/dev/null || true
sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';" 2>/dev/null || true
sqlite3 "$DB_PATH" "ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';" 2>/dev/null || true

export GO_PORT="${PORT:-10000}"
export ENV="${ENV:-production}"
export DB_PATH

echo "[entrypoint] starting server on port $GO_PORT using DB_PATH=$DB_PATH"
exec ./server
