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

Both services should report `healthy` within ~20 seconds.

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

## Future (Phase 8)

This host is also where the backup routine runs: `pg_dump` and
`mongodump` against the local containers, tarballed and rotated under
a directory managed by a dedicated backup container or systemd timer.
Restore from a captured snapshot is documented at the same time.
