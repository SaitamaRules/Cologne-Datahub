#!/usr/bin/env bash
#
# restore.sh — Cologne DataHub (vm-db)
#
# Restores a backup archive produced by backup.sh.
#
#   Usage:
#     docker compose exec backup restore.sh /backups/daily/cologne-datahub_<TS>.tar.gz
#
# DESTRUCTIVE: existing objects in the target databases are dropped and
# recreated from the archive. Intended to be run manually by an operator,
# never on a schedule.

set -euo pipefail

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
MONGO_URI="${MONGO_URI:-mongodb://mongo:27017}"

: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"

ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: $0 <path-to-backup.tar.gz>" >&2
  exit 1
fi

log() { printf '%s [restore] %s\n' "$(date +%H:%M:%S)" "$*"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log "Extracting $(basename "$ARCHIVE")"
tar --extract --gzip --file="$ARCHIVE" --directory="$WORK"

PG_DUMP_FILE="${WORK}/postgres_${DB_NAME}.dump"
MONGO_ARCHIVE="${WORK}/mongodb.archive.gz"

# --- PostgreSQL ------------------------------------------------------------
if [[ -f "$PG_DUMP_FILE" ]]; then
  log "Restoring PostgreSQL '${DB_NAME}' (drop + recreate objects)"
  PGPASSWORD="$DB_PASSWORD" pg_restore \
    --host="$PG_HOST" --port="$PG_PORT" \
    --username="$DB_USER" --dbname="$DB_NAME" \
    --clean --if-exists --no-owner \
    "$PG_DUMP_FILE"
else
  log "WARNING: no PostgreSQL dump in archive — skipping"
fi

# --- MongoDB ---------------------------------------------------------------
if [[ -f "$MONGO_ARCHIVE" ]]; then
  log "Restoring MongoDB (--drop)"
  mongorestore --uri="$MONGO_URI" --gzip --archive="$MONGO_ARCHIVE" --drop
else
  log "WARNING: no MongoDB archive in archive — skipping"
fi

log "Restore complete"
