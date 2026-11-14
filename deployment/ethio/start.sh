#!/bin/sh
set -eu

: "${PORT:=8080}"
: "${DATABASE_URL:?Set DATABASE_URL to the PostgreSQL add-on URL}"
: "${REDIS_URL:?Set REDIS_URL to the Redis add-on URL}"
: "${JWT_ACCESS_SECRET:?Set a strong JWT_ACCESS_SECRET}"
: "${JWT_REFRESH_SECRET:?Set a strong JWT_REFRESH_SECRET}"

# Wait briefly for the managed database to become reachable, then sync schema.
attempt=0
until npx prisma db push --schema backend/prisma/schema.prisma --skip-generate; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    echo "Database schema setup failed after 20 attempts." >&2
    exit 1
  fi
  echo "Waiting for PostgreSQL (attempt $attempt/20)..."
  sleep 5
done

# Seed creates demo accounts, virtual wallets and local game metadata.
npx tsx backend/prisma/seed.ts

# Substitute only PORT so nginx variables such as $uri remain intact.
envsubst '$PORT' < /etc/nginx/conf.d/default.conf > /tmp/casino-nginx.conf
cp /tmp/casino-nginx.conf /etc/nginx/conf.d/default.conf

exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
