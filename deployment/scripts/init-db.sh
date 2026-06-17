#!/bin/sh
# Runs once on first Postgres init (mounted into /docker-entrypoint-initdb.d).
# The database itself is created by the image from POSTGRES_DB; here we just
# enable extensions Prisma / the app may rely on. Idempotent.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE EXTENSION IF NOT EXISTS "citext";
EOSQL

echo "init-db: extensions ready on database '$POSTGRES_DB'"
