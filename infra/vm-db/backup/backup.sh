#!/usr/bin/env bash
#
# backup.sh — Cologne DataHub (vm-db)
#
# Creates a single timestamped, gzip-compressed archive containing:
#   - PostgreSQL dump      (pg_dump, custom format)
#   - MongoDB dump         (mongodump, gzip archive)
#   - OPNsense config.xml  (pulled via the firewall API; best-effort)
#
# Retention: KEEP_DAILY daily copies, KEEP_WEEKLY weekly copies
# (a weekly snapshot is promoted from the daily set on Sundays).
#
# Runs inside the `backup` helper container, triggered by Ofelia
# (job-exec). Configuration comes from the environment — see
# docker-compose.yml and infra/vm-db/.env.

set -euo pipefail

# --- Configuration (sane defaults; overridable via environment) -----------
PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
MONGO_URI="${MONGO_URI:-mongodb://mongo:27017}"

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"

OPNSENSE_HOST="${OPNSENSE_HOST:-}"
# OPNSENSE_API_KEY / OPNSENSE_API_SECRET are read from the environment.

TS="$(date +%Y-%m-%d_%H%M%S)"
ARCHIVE_NAME="cologne-datahub_${TS}.tar.gz"

log() { printf '%s [backup] %s\n' "$(date +%H:%M:%S)" "$*"; }

# Keep the newest $2 archives in directory $1, delete the rest.
# Filenames embed a sortable timestamp, so glob order == age order (oldest first).
prune() {
  local dir="$1" keep="$2" files
  shopt -s nullglob
  files=( "$dir"/cologne-datahub_*.tar.gz )
  shopt -u nullglob
  local total=${#files[@]}
  (( total > keep )) || return 0
  local remove=$(( total - keep ))
  log "Pruning $(basename "$dir"): ${total} -> ${keep}"
  rm -f "${files[@]:0:remove}"
}

# --- Required secrets ------------------------------------------------------
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

# --- PostgreSQL ------------------------------------------------------------
log "Dumping PostgreSQL database '${DB_NAME}' from ${PG_HOST}:${PG_PORT}"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$PG_HOST" --port="$PG_PORT" \
  --username="$DB_USER" --dbname="$DB_NAME" \
  --format=custom \
  --file="${WORK}/postgres_${DB_NAME}.dump"

# --- MongoDB ---------------------------------------------------------------
log "Dumping MongoDB from ${MONGO_URI}"
mongodump --uri="$MONGO_URI" --gzip --archive="${WORK}/mongodb.archive.gz"

# --- OPNsense configuration (best-effort) ----------------------------------
# The firewall config is treated as data, not code. A failure here must not
# abort the database backup, so the pull is wrapped and tolerated.
if [[ -n "$OPNSENSE_HOST" && -n "${OPNSENSE_API_KEY:-}" && -n "${OPNSENSE_API_SECRET:-}" ]]; then
  log "Pulling OPNsense configuration from ${OPNSENSE_HOST}"
  if curl --fail --silent --show-error --insecure \
       --user "${OPNSENSE_API_KEY}:${OPNSENSE_API_SECRET}" \
       "https://${OPNSENSE_HOST}/api/core/backup/download/this" \
       --output "${WORK}/opnsense-config.xml"; then
    log "OPNsense configuration saved"
  else
    log "WARNING: OPNsense pull failed — continuing without firewall config"
    rm -f "${WORK}/opnsense-config.xml"
  fi
else
  log "OPNsense API not configured — skipping firewall config"
fi

# --- Bundle ----------------------------------------------------------------
log "Creating archive ${ARCHIVE_NAME}"
tar --create --gzip --file="${DAILY_DIR}/${ARCHIVE_NAME}" --directory="$WORK" .

# --- Retention: daily ------------------------------------------------------
prune "$DAILY_DIR" "$KEEP_DAILY"

# --- Retention: weekly (promote on Sundays) --------------------------------
if [[ "$(date +%u)" -eq 7 ]]; then
  log "Sunday — promoting today's archive to the weekly set"
  cp "${DAILY_DIR}/${ARCHIVE_NAME}" "${WEEKLY_DIR}/"
  prune "$WEEKLY_DIR" "$KEEP_WEEKLY"
fi

log "Done: ${DAILY_DIR}/${ARCHIVE_NAME} ($(du -h "${DAILY_DIR}/${ARCHIVE_NAME}" | cut -f1))"
