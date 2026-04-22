# Roadmap

The TFC is organised in 10 phases. Each closed phase is marked with an annotated Git tag.

| Phase | Title                               | Tag      | Status         |
| ----- | ----------------------------------- | -------- | -------------- |
| 0     | Baseline & repo professionalisation | `v0.4.1` | ✅ Done        |
| 1     | Containerisation                    | `v0.5.0` | ✅ Done        |
| 2     | Continuous Integration              | `v0.6.0` | ✅ Done        |
| 3     | Reverse proxy (Nginx)               | `v0.7.0` | ✅ Done        |
| 4     | TLS with internal CA                | —        | 🟡 In progress |
| 5     | Rate limiting (L7)                  | —        | ⏳ Pending     |
| 6     | Internal DNS (BIND9)                | —        | ⏳ Pending     |
| 7     | OPNsense perimeter (DMZ + LAN)      | —        | ⏳ Pending     |
| 8     | Automated backups                   | —        | ⏳ Pending     |
| 9     | Monitoring (Python stdlib)          | —        | ⏳ Pending     |
| 10    | Memoria and defence                 | —        | ⏳ Pending     |

## Completed phases

### Phase 0 — Baseline

Code cleanups, directory restructure (`app/`, `infra/`, `docs-tfc/`), introduction of project-level meta files: `LICENSE` (MIT), `SECURITY.md`, `CHANGELOG.md`, `Makefile`, Dependabot config, `.gitattributes` (LF enforcement). ADR-0001 documents the repository structure.

### Phase 1 — Containerisation

Application hardening (`/health` and `/health/ready` endpoints, uniform error format, fail-fast environment validation) and containerisation: multi-stage Dockerfile running as non-root, pinned Deno version, minimal runtime permissions. `docker-compose.yml` orchestrates Postgres, Mongo, the application and profile-gated importer services. ADR-0002 (Deno), ADR-0003 (Hono), ADR-0004 (dual database rationale).

### Phase 2 — Continuous Integration

Introduction of the integration test suite: 14 tests against real ephemeral databases, covering health, PostgreSQL CRUD, MongoDB listing, geospatial queries, auth and error format. GitHub Actions workflow with three parallel jobs (lint, test, build) and caching of Docker layers. Badges and CI visibility in the README.

### Phase 3 — Reverse proxy

Nginx `alpine` introduced in front of the application. Shared `proxy.conf` snippet for common directives, JSON access logs correlated with the app via `X-Request-ID`, explicit allow-list of proxied routes with deny-by-default on anything else. The application is no longer exposed directly — only Nginx publishes port 80. Fourth CI job (end-to-end) spins up the full stack and validates the proxy. ADR-0005.

## Upcoming phases

### Phase 4 — TLS with internal CA

Generate a root CA and a server certificate signed by it, entirely in-repo via OpenSSL (containerised). Nginx listens on 443 with modern cipher suites (TLS 1.2+), redirects 80 → 443, sets HSTS. The E2E CI job is adapted to accept the internal CA.

### Phase 5 — Rate limiting

L7 rate limiting with `limit_req_zone` and `limit_conn`. Different policies per route family (lenient on reads, strict on writes, tight on `/docs`). Load tested with `wrk` or `ab` until 429 responses are observed; thresholds documented in the memoria.

### Phase 6 — Internal DNS

A BIND9 service is added. A private zone (`cologne.local`) defines A records for `api`, `db-pg`, `db-mongo`, `proxy`, `monitor`. Nginx upstreams and application env vars refactored to use FQDNs instead of compose service names.

### Phase 7 — OPNsense perimeter

The stack is deployed across three Ubuntu Server VMs in VMware Workstation, sitting behind an OPNsense firewall:

- **DMZ** (`192.168.113.0/24`): Nginx + BIND9.
- **LAN** (`10.10.10.0/24`): app + Postgres + Mongo + the Python monitor (Phase 9).

Firewall policy is explicit: WAN → DMZ only on 443/tcp; DMZ → LAN only on the database ports and only from the app's IP; LAN → WAN via NAT. `nmap` sweeps from each segment validate the policy. State table limits and SYN flood protection at L3/L4 complement the L7 rate limiting from Phase 5. ADR-0007 documents the choice of OPNsense over pfSense.

### Phase 8 — Automated backups

`scripts/backup.sh` performs `pg_dump` + `mongodump`, compresses them, and rotates with a 7-daily + 4-weekly policy. Scheduled by cron in the LAN host (or an `ofelia` sidecar). `scripts/restore.sh` is the symmetric counterpart. A real restore is performed and documented as evidence.

### Phase 9 — Monitoring daemon

A small Python daemon written against the standard library only — no external dependencies. It queries `/var/run/docker.sock` via `http.client` to enumerate containers, pings TCP ports with `socket`, holds state in memory to emit alerts only on `up ↔ down` transitions, and sends those alerts via Telegram using `urllib.request`. Runs as a containerised service in the LAN segment. ADR-0008 documents why the standard library suffices over a Prometheus/Grafana stack for this scale.

### Phase 10 — Memoria and defence

Written report (memoria TFC), network topology and sequence diagrams, operational runbook (fresh deployment, restore procedure, certificate rotation, alert response), slide deck and anticipated questions script for the oral defence.
