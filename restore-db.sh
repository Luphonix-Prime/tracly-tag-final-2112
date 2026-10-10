#!/bin/bash
set -euo pipefail

echo "========================================================"
echo "       TraclyTag PostgreSQL Guarded Recovery Script"
echo "========================================================"

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: ./restore-db.sh path/to/backup.backup"
  echo "Available backups:"
  ls -la backups/*.backup 2>/dev/null || echo "None found"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] File '${BACKUP_FILE}' not found!"
  exit 1
fi

echo "[!] WARNING: This will DROP and RECREATE the database!"
read -p "Type RESTORE to proceed: " CONFIRM
if [ "${CONFIRM}" != "RESTORE" ]; then
  echo "[ABORT] Restore cancelled."
  exit 0
fi

POSTGRES_USER="tracelytag"
POSTGRES_DB="tracelytag"

if [ -f .env ]; then
  export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env | xargs -d '\n' || true)
fi

echo "[*] Ensuring db service is healthy..."
docker compose up -d --wait db

echo "[*] Stopping app container..."
docker compose stop app 2>/dev/null || true

echo "[*] Dropping and recreating target database..."
docker compose exec -T db dropdb --if-exists --username="${POSTGRES_USER}" "${POSTGRES_DB}"
docker compose exec -T db createdb --username="${POSTGRES_USER}" "${POSTGRES_DB}"

echo "[*] Restoring data..."
docker compose exec -T db pg_restore --username="${POSTGRES_USER}" --dbname="${POSTGRES_DB}" --exit-on-error --no-owner --no-privileges < "${BACKUP_FILE}"

echo "[*] Restarting app..."
docker compose start app

echo "========================================================"
echo "[SUCCESS] Database restored from ${BACKUP_FILE}"
echo "========================================================"
