#!/bin/bash
set -euo pipefail

echo "========================================================"
echo "       TraclyTag PostgreSQL Atomic Backup Snapshot"
echo "========================================================"

mkdir -p backups

POSTGRES_USER="tracelytag"
POSTGRES_DB="tracelytag"

if [ -f .env ]; then
  # Source variables from .env
  export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env | xargs -d '\n' || true)
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backups/tracelytag_${TIMESTAMP}.backup"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

echo "[*] Pausing application container..."
docker compose stop app 2>/dev/null || true

echo "[*] Executing pg_dump inside db container..."
docker compose exec -T db pg_dump --username="${POSTGRES_USER}" --dbname="${POSTGRES_DB}" --format=custom --no-owner --no-privileges > "${BACKUP_FILE}"

echo "[*] Generating SHA256 checksum..."
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

echo "[*] Restarting application container..."
docker compose start app 2>/dev/null || true

echo "========================================================"
echo "[SUCCESS] Backup created: ${BACKUP_FILE}"
echo "[SUCCESS] SHA256:         ${CHECKSUM_FILE}"
echo "========================================================"
