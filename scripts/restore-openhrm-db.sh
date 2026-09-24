#!/usr/bin/env bash
# Restore OpenHRM database from daily backup (requires postgres OS superuser once).
set -euo pipefail

BACKUP_DATE="${1:-2026-06-23}"
BACKUP_FILE="/var/www/openhrm/backup/${BACKUP_DATE}/full-database.sql"
PG_PORT=5439
PG_USER=openhrmadmin
PG_PASS="${PGPASSWORD:-}"
DB_NAME=openhrm

if [[ -z "$PG_PASS" ]]; then
  echo "Set PGPASSWORD to the database password before running this script." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "==> Ensuring database ${DB_NAME} exists..."
if ! sudo -u postgres psql -p "$PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -p "$PG_PORT" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${PG_USER};"
  echo "Created database ${DB_NAME}"
else
  echo "Database ${DB_NAME} already exists — terminating connections before restore..."
  sudo -u postgres psql -p "$PG_PORT" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();"
  sudo -u postgres psql -p "$PG_PORT" -d postgres -c "DROP DATABASE ${DB_NAME};"
  sudo -u postgres psql -p "$PG_PORT" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${PG_USER};"
fi

echo "==> Restoring from ${BACKUP_FILE} ..."
export PGPASSWORD="$PG_PASS"
psql -h localhost -p "$PG_PORT" -U "$PG_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"

echo "==> Verifying row counts..."
psql -h localhost -p "$PG_PORT" -U "$PG_USER" -d "$DB_NAME" -c \
  "SELECT 'ServiceProvider' AS t, count(*) FROM public.\"ServiceProvider\"
   UNION ALL SELECT 'Company', count(*) FROM public.\"Company\"
   UNION ALL SELECT 'User', count(*) FROM public.\"User\";"

echo "==> Restarting OpenHRM backend..."
pm2 restart openhrm-backend 2>/dev/null || true

echo "Done. OpenHRM data restored from backup ${BACKUP_DATE}."
