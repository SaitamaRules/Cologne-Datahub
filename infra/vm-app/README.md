# vm-app — LAN host (Deno API)

Deployment artefacts for the application-tier host of the Phase 7 lab.

## Role

Single service: the Deno/Hono API container. Acts as the only client
of the data tier (vm-db) and the only upstream of the proxy (vm-web).

**Network:** LAN `10.10.10.0/24`. **Host IP:** `10.10.10.20`.

## Dependencies (all remote, no compose-level depends_on)

- **BIND9** on `vm-web` (`192.168.113.30:53`) for all DNS resolution.
- **PostgreSQL** on `vm-db` (`10.10.10.10:5432`).
- **MongoDB** on `vm-db` (`10.10.10.10:27017`).
- **OPNsense rules** (sub-phase C.9):
  - LAN → DMZ:53 (so this container can resolve via vm-web's BIND9)
  - LAN → LAN:5432/27017 (so this container can reach vm-db)
  - DMZ → LAN:8000 (so Nginx on vm-web can reach this container)

The container restarts (`restart: unless-stopped`) until all of the
above are reachable.

## Pre-deployment checklist

1. Repo cloned on vm-app under `~/Cologne-Datahub`.
2. `.env` present at repo root with `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
   `API_KEY`. Same values as the rest of the lab. Example:
   ```env
   DB_NAME=cologne_datahub
   DB_USER=postgres
   DB_PASSWORD=<chosen>
   API_KEY=<chosen>
   ```
3. vm-db and vm-web stacks already up (sub-phases C.7 and C.5
   respectively). The bring-up order in C.10 enforces this.

## Deployment

From inside vm-app:

```bash
cd ~/Cologne-Datahub
docker compose -f infra/vm-app/docker-compose.yml --env-file .env build
docker compose -f infra/vm-app/docker-compose.yml --env-file .env up -d
docker compose -f infra/vm-app/docker-compose.yml --env-file .env ps
```

The `app` service should reach `healthy` within ~30 seconds of vm-db
being available.

## Seeding the databases (one-shot)

```bash
# Fetch the source data once, on this host
cd ~/Cologne-Datahub/app
deno run --allow-net --allow-write scripts/fetch_data.ts

# Load into both engines
cd ~/Cologne-Datahub
docker compose -f infra/vm-app/docker-compose.yml --env-file .env \
  --profile import run --rm import-pg
docker compose -f infra/vm-app/docker-compose.yml --env-file .env \
  --profile import run --rm import-mongo
```

## Validation from vm-app

```bash
# DNS resolution works through BIND9 on vm-web
getent hosts db-pg.cologne.local                  # 10.10.10.10
getent hosts db-mongo.cologne.local               # 10.10.10.10

# The API responds on the host
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
```

## Local syntax validation (Windows dev machine)

```powershell
docker compose -f infra/vm-app/docker-compose.yml --env-file .env config | Out-Null
```

Exit 0 = compose parses cleanly. Runtime validation needs the live host.
