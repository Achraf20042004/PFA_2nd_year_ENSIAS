#!/bin/bash
set -e

# ── Wait for PostgreSQL ───────────────────────────────────────────────────────
echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -q; do
    sleep 1
done
echo "PostgreSQL is ready."

# ── Analytics SQLite DB ────────────────────────────────────────────────────────
# Ensure the analytics.db file exists and is writable before Django touches it.
# This guard runs on every container start so it survives volume re-mounts.
ANALYTICS_DB_DIR="/app/analytics_db"
ANALYTICS_DB_FILE="${ANALYTICS_DB_DIR}/analytics.db"
mkdir -p "${ANALYTICS_DB_DIR}"
touch "${ANALYTICS_DB_FILE}"
chmod 664 "${ANALYTICS_DB_FILE}"
echo "Analytics DB ready at ${ANALYTICS_DB_FILE}."

# ── Django setup ──────────────────────────────────────────────────────────────
echo "Running migrations..."
python manage.py migrate --noinput
python manage.py migrate --database=analytics --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || echo "collectstatic skipped"
# ── Start server ──────────────────────────────────────────────────────────────
exec "$@"
