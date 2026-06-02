# vm-db — LAN host (PostgreSQL + MongoDB)

Deployment artefacts for the data-tier host of the Phase 7 lab.

## Role

Two independent data services on the same host:

- **PostgreSQL 16** on port 5432 — relational schema, normalised.
- **MongoDB 7** on port 27017 — GeoJSON storage with a `2dsphere` index.

The only client of either engine is the application container on
vm-app. PostgreSQL and MongoDB never talk to each other.

**Network:** LAN `10.10.10.0/24`. **Host IP:** `10.10.10.10`.

## Dependencies

- **OPNsense rules** (sub-phase C.9):
  - LAN → LAN:5432/27017 from vm-app's IP to this host's IP.
  - LAN → DMZ:53 (so the containers can use BIND9 on vm-web — not
    strictly required for these services, but consistent with the
    rest of the lab).

No application-level dependencies. Each engine starts independently.

## Pre-deployment checklist

1. Repo cloned on vm-db under `~/Cologne-Datahub`.
2. `.env` present at repo root with the same `DB_NAME`, `DB_USER`,
   `DB_PASSWORD` values used on vm-app. Mismatch here is the most
   common cause of authentication failures from the API.

## Deployment

From inside vm-db:

```bash
cd ~/Cologne-Datahub
docker compose -f infra/vm-db/docker-compose.yml --env-file .env up -d
docker compose -f infra/vm-db/docker-compose.yml --env-file .env ps
```

PostgreSQL and MongoDB should report `healthy` within ~20 seconds. The
`backup`, `ofelia` and `monitor` containers (Phases 8–9) have no
healthcheck and simply run in the background.

The first run also applies `app/queries/schema.sql` to PostgreSQL
through the `docker-entrypoint-initdb.d/` mount. Subsequent runs skip
this because the database already exists in the volume.

## Validation from vm-db

```bash
# PostgreSQL is up and accepting connections
docker compose -f infra/vm-db/docker-compose.yml --env-file .env \
  exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"

# Mongo responds to ping
docker compose -f infra/vm-db/docker-compose.yml --env-file .env \
  exec -T mongo mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok"

# Ports listen on the LAN interface (not just 127.0.0.1)
ss -tlnp | grep -E '5432|27017'
```

## Validation from vm-app (the actual client)

```bash
# DNS resolves and the ports are reachable across the LAN
getent hosts db-pg.cologne.local                  # 10.10.10.10
nc -zv 10.10.10.10 5432
nc -zv 10.10.10.10 27017
```

## Local syntax validation (Windows dev machine)

```powershell
docker compose -f infra/vm-db/docker-compose.yml --env-file .env config | Out-Null
```

Exit 0 = compose parses cleanly.

## Backups (Phase 8)

A dedicated `backup` container holds the dump tooling
(`pg_dump`/`pg_restore`, `mongodump`/`mongorestore`, `curl`) and idles;
an Ofelia sidecar triggers `backup.sh` daily at 03:00 from a schedule
declared in compose labels.

`backup.sh` writes a single timestamped `tar.gz` under
`infra/vm-db/backups/` (gitignored) containing a PostgreSQL
custom-format dump, a gzipped MongoDB archive, and — when the OPNsense
API credentials are set — the firewall's running configuration.
Retention is 7 daily + 4 weekly (the weekly copy promoted on Sundays).

Run a backup on demand:

```bash
docker compose -f infra/vm-db/docker-compose.yml --env-file .env \
  exec backup backup.sh
```

Restore a chosen archive (destructive — drops and recreates objects):

```bash
docker compose -f infra/vm-db/docker-compose.yml --env-file .env \
  exec backup restore.sh /backups/daily/cologne-datahub_<TS>.tar.gz
```

The OPNsense pull is optional: leave `OPNSENSE_API_KEY` /
`OPNSENSE_API_SECRET` blank in `.env` to skip it. When used, the key
should be a read-only account limited to the "Configuration History"
privilege. Rationale in
[ADR-0010](../../docs-tfc/adr/0010-automated-backups.md).

## Monitoring (Phase 9)

A standard-library-only Python `monitor` container TCP-probes the lab's
services every 30 seconds — PostgreSQL and MongoDB locally (by service
name), and the API, Nginx and BIND9 across the segments by lab IP — and
alerts only on up↔down transitions. Alerts go to Telegram via `urllib`
when `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are set in `.env`,
otherwise to the log.

Follow it:

```bash
docker compose -f infra/vm-db/docker-compose.yml --env-file .env \
  logs -f monitor
```

Reaching the API port from this host requires one least-privilege UFW
allow on vm-app (the monitor's traffic egresses as this host's IP):

```bash
sudo ufw allow from 10.10.10.10 to any port 8000 proto tcp \
  comment 'monitor on vm-db'
```

Rationale in [ADR-0011](../../docs-tfc/adr/0011-service-monitoring.md).
