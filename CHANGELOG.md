# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-06-02

The project is complete. This release marks the finished state of the
TFC: all phases delivered and documentation finalised. The system is an
academic-professional deliverable; the oral defence is a live
presentation external to the repository.

### Changed

- Documentation finalised for the completed project: `README.md` status
  and from-scratch deployment pointers; `docs/ARCHITECTURE.md`
  observability and repository-layout sections (service monitor built,
  backups documented, ADRs 0001–0011); `infra/vm-db/README.md` backup
  and monitor operations; `docs/ROADMAP.md` with all ten phases marked
  complete.

## [0.13.0] - 2026-05-28

### Added

- Service availability monitor on `vm-db`: a standard-library-only
  Python container (`infra/vm-db/monitor/`) that TCP-probes the lab's
  services every 30 seconds and alerts only on up↔down transitions.
- `monitor.py` checks PostgreSQL and MongoDB locally (by Docker
  service name) and the API (`vm-app`), Nginx and BIND9 (`vm-web`)
  across the segments by lab IP. State is held in memory, so a service
  that stays down is announced once rather than every cycle.
- Telegram alerting through `urllib` (no third-party client), with a
  log-only fallback when `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are
  unset. Image is `python:3.12-slim` with no `pip` installs.
- ADR-0011 documenting the choice of a standard-library monitor over a
  Prometheus/Grafana stack, Uptime Kuma and a hosted uptime service.

### Changed

- `infra/vm-db/docker-compose.yml` extended with the `monitor`
  service; existing services are unchanged.
- `.env.example` documents the optional `TELEGRAM_BOT_TOKEN` /
  `TELEGRAM_CHAT_ID` variables.

### Security

- The monitor publishes no ports and mounts no Docker socket — it is a
  pure outbound TCP client. Reaching the API required a single
  least-privilege UFW allow on `vm-app` (`10.10.10.10 → 8000/tcp`),
  mirroring the existing proxy-only rule rather than widening it.

## [0.12.0] - 2026-05-28

### Added

- Automated backup tooling on `vm-db`: a purpose-built `backup` helper
  image (PostgreSQL 16 client + MongoDB Database Tools 100.17.0 +
  curl) under `infra/vm-db/backup/`, holding `backup.sh` and
  `restore.sh`.
- `backup.sh` dumps PostgreSQL (`pg_dump`, custom format) and MongoDB
  (`mongodump`, gzipped archive) and pulls the OPNsense running
  configuration through its REST API (best-effort), bundling all three
  into a single timestamped `tar.gz`. Retention is 7 daily plus 4
  weekly, with the weekly snapshot promoted from the daily set on
  Sundays.
- `restore.sh`, the symmetric counterpart: a manual, destructive
  restore of a chosen archive (`pg_restore --clean --if-exists`,
  `mongorestore --drop`).
- Ofelia (`mcuadros/ofelia:0.3.22`) sidecar scheduling the daily
  backup at 03:00 via container labels (`job-exec`), so the cadence is
  versioned in the compose file rather than in an out-of-band host
  crontab.
- ADR-0010 documenting the choice of an Ofelia sidecar over host cron,
  a dedicated backup framework (pgBackRest) and a managed off-host
  service.

### Changed

- `infra/vm-db/docker-compose.yml` extended with the `backup` and
  `ofelia` services; the existing `postgres` and `mongo` services are
  unchanged. The `backup` container reads database credentials from
  the existing host `.env` via `env_file`, keeping secrets out of git.
- `.env.example` documents the optional `OPNSENSE_API_KEY` /
  `OPNSENSE_API_SECRET` variables that enable the firewall-config
  pull.

### Security

- When enabled, the OPNsense configuration pull uses a dedicated
  read-only API account limited to the "Configuration History"
  privilege. The pull is best-effort and never aborts the database
  backup.
- Local backup artifacts (`infra/vm-db/backups/`) are gitignored and
  never committed.

## [0.11.0] - 2026-05-28

### Added

- Per-VM deployment layout for the DMZ/LAN topology:
  `infra/vm-web/` (Nginx + BIND9, DMZ), `infra/vm-app/` (Deno API,
  LAN) and `infra/vm-db/` (PostgreSQL + MongoDB, LAN), each with its
  own `docker-compose.yml` and README.
- `infra/opnsense/` documentation layer: `RULES.md` (flow matrix,
  NAT and per-interface rules mirroring the running firewall) and
  `NMAP.md` (verification scans from three vantage points, zero
  deviations from the declared posture).
- Two reverse zones in BIND9 for the lab segments
  (`113.168.192.in-addr.arpa` and `10.10.10.in-addr.arpa`) replacing
  the single compose-subnet reverse zone.
- Server certificate SANs for the Phase 7 access paths
  (`datahub.cologne.local`, `proxy.cologne.local`,
  `web.cologne.local`) signed by the reused internal CA.
- Phase 7 network topology diagram (Mermaid) in
  `docs/ARCHITECTURE.md`.
- ADR-0009 documenting the choice of OPNsense over pfSense CE, VyOS
  and hand-rolled nftables.

### Changed

- The monolithic single-host stack moved to `infra/dev-local/`
  (compose, bind9, nginx, certs) and is preserved unchanged in
  behaviour as the development and CI environment.
- BIND9 reconfigured for the split topology: authoritative for
  `cologne.local` against the physical lab IPs (`192.168.113.30`
  for DMZ services, `10.10.10.10`/`10.10.10.20` for LAN services)
  and recursive forwarder to OPNsense's Unbound, the single DNS
  egress of the lab.
- BIND9 now runs with `dnssec-validation no` (Unbound on OPNsense
  is the validating resolver) and its trusted ACL includes the
  compose-internal Docker network so the Nginx container can query.
- Nginx upstream still resolves `api.cologne.local:8000` by FQDN;
  the underlying IP moved to `10.10.10.20` (vm-app on LAN) with no
  change to the configuration, demonstrating the DNS decoupling.
- `Makefile` and `.github/workflows/ci.yml` updated to the
  `infra/dev-local/` path; CI behaviour is unchanged.
- `.gitignore` rule broadened to `infra/**/certs/out/` so both
  dev-local and vm-web keep their keys untracked.

### Security

- Per-host UFW hardened on all three VMs with service-specific
  inbound allows: DNS from DMZ/LAN on vm-web, API port from the
  proxy IP only on vm-app, database ports from the app IP only on
  vm-db. SSH restricted to the LAN subnet, root login disabled,
  `MaxAuthTries 3`.
- `fail2ban` watching SSH and `auditd` recording identity, sudo,
  SSH and firewall events on every VM (blue-team baseline).
- OPNsense perimeter with default-deny on WAN and DMZ: the only
  externally reachable surface is 443/tcp (DNATed to Nginx). DMZ →
  LAN is limited to the API port; the data tier is unreachable from
  DMZ. L3/L4 state-table limits complement the Phase 5 L7 rate
  limiting. Verified by the `nmap` scans in `infra/opnsense/NMAP.md`.

## [0.10.0] - 2026-04-27

### Added

- BIND9 service authoritative for the `cologne.local` zone.
  Configuration in `infra/bind9/`: `named.conf` (no recursion,
  tight `allow-query` ACL), forward zone `db.cologne.local` and
  reverse zone `db.172.28` covering the compose subnet.
- Five A records for the project's services: `ns`, `db-pg`,
  `db-mongo`, `api` and `proxy`. Matching PTR records in the
  reverse zone enable `dig -x` lookups.
- E2E CI step that asserts DNS resolution from inside the network
  for four representative records (`api`, `db-pg`, `db-mongo` and
  `proxy`), running `getent hosts` from the existing service
  containers.
- ADR-0008 documenting the choice of BIND9 over Docker's embedded
  DNS, dnsmasq/CoreDNS and `extra_hosts` inline maps.

### Changed

- The compose network now declares a fixed subnet
  (`172.28.0.0/24`) and every service receives a pinned
  `ipv4_address`. The IPs in the BIND9 zone file reference these
  exact addresses; the two files must be kept in sync manually.
- Every service in the compose stack is configured with
  `dns: 172.28.0.5`, making BIND9 their primary resolver. The
  application, the proxy and the import jobs all use FQDNs from
  `cologne.local` to reach their dependencies.
- Nginx upstream `cologne_app` now resolves through BIND9 to
  `api.cologne.local:8000`. The application's
  `DB_HOST`/`MONGO_URI` environment variables now point at
  `db-pg.cologne.local` and `db-mongo.cologne.local` respectively.
- `.env.example` updated to document the new FQDN-based defaults.

## [0.9.0] - 2026-04-27

### Added

- L7 rate limiting in Nginx with three request-rate zones and one
  connection zone, keyed on the client IP:
  - **Reads** (`GET /api/*`): 30 req/s, burst 60.
  - **Writes** (`POST/PUT/DELETE /api/*`): 5 req/s, burst 10.
  - **Docs** (`/docs`): 2 req/s, burst 5.
  - **Connections**: 20 simultaneous per IP across all locations.
- `infra/nginx/RATE_LIMITS.md` documenting the threat model, the
  numeric justification of every limit, the behaviour on rejection,
  and a full `wrk`-based load-test transcript demonstrating that the
  reads zone allows exactly the documented budget (`30 req/s × 10 s
  - burst 60 = 360` successful requests in a 10-second window).
- E2E CI job extended with a burst test: runs `wrk` against
  `/api/trees` and asserts that at least 70% of responses are
  non-2xx/3xx, confirming the rate limiter is effective.
- ADR-0007 documenting the choice of native Nginx rate limiting
  over application-level limiting, third-party WAFs, and relying on
  Phase 7 OPNsense controls alone.

### Changed

- Nginx returns `429 Too Many Requests` on rate-limit violations
  instead of the default `503 Service Unavailable`. RFC 6585 reserves
  503 for actual upstream unavailability.
- Rate-limited requests are logged at `warn` level in the Nginx
  error log, identifying client, zone, and path.
- The `/api/` location now distinguishes read methods from write
  methods through an internal rewrite to a non-public `/__write/`
  location, so each method family can apply a different zone
  without using `if` (which has known issues inside `location`
  blocks).

## [0.8.0] - 2026-04-27

### Added

- Internal Certificate Authority. The script
  `infra/certs/generate-certs.sh` (run inside an `alpine/openssl`
  container) creates a 4096-bit RSA root CA valid for ten years and
  signs a 2048-bit RSA server certificate, also valid for ten years,
  covering `cologne-datahub.local`, `localhost`, and `127.0.0.1`.
- Versioned `infra/certs/openssl.cnf` with explicit X.509 extensions
  for both the CA and the server certificate (key usage, extended key
  usage, SANs, basic constraints).
- TLS termination in Nginx on port 443. HTTP/2 enabled. TLS 1.2 and
  1.3 only, with AEAD cipher suites and server-side preference.
  `ssl_session_tickets off` to keep forward secrecy guarantees on
  reconnects.
- HSTS header with `max-age=31536000; includeSubDomains` on every
  HTTPS response.
- HTTP-to-HTTPS redirect (`301`) on every request to port 80, with
  the single exception of `/nginx-health` which stays plain to keep
  Docker healthchecks free of CA awareness.
- CI E2E job extended for HTTPS: generates a fresh CA and server
  certificate per run, validates the redirect, the HSTS header,
  `X-Request-ID` propagation, and that TLS 1.0 is rejected.
- ADR-0006 documenting the choice of an internal CA over Let's
  Encrypt, self-signed certificates, and mkcert.

### Changed

- The Nginx service in the main compose stack now publishes both
  ports 80 and 443 on `127.0.0.1`. The certificate directory
  (`infra/certs/out/`) is mounted read-only into the container.
- `infra/certs/out/` added to `.gitignore`. The CA and server
  private keys are never committed.

## [0.7.0] - 2026-04-22

### Added

- Nginx reverse proxy (`nginx:alpine`) in front of the application,
  with upstream to `app:8000`, JSON access logs, `X-Request-ID`
  propagation and a dedicated `/nginx-health` edge probe.
- Shared `snippets/proxy.conf` with the common `proxy_*` directives,
  included from every proxied location to avoid drift.
- `infra/nginx/` directory with the full proxy configuration and a
  brief README documenting the route table and the planned evolution
  (TLS in Phase 4, rate limiting in Phase 5).
- End-to-end smoke test in CI: spins up the full stack, probes
  `/nginx-health`, `/health`, `/health/ready`, verifies `X-Request-ID`
  round-trip and the deny-by-default 404 on unknown paths.
- ADR-0005 documenting the choice of Nginx over Caddy, Traefik and
  no-proxy alternatives.

### Changed

- The application service no longer publishes a port to the host.
  The only externally reachable service is Nginx (`127.0.0.1:80`),
  which in turn forwards to the app inside the compose network.
- The healthcheck for the Nginx service uses `nc -z 127.0.0.1 80`.
  Bound to `127.0.0.1` explicitly to avoid IPv6 resolution surprises
  on the official `nginx:alpine` image (same lesson as the test
  suite in Phase 2).
- CI `e2e` job waits for all services to become healthy by polling
  `docker compose ps` instead of relying on `--wait`, which proved
  unreliable alongside `--build`.

## [0.6.0] - 2026-04-21

### Added

- GitHub Actions CI workflow (`.github/workflows/ci.yml`) with three
  parallel jobs: lint (fmt/lint/typecheck), integration tests against
  ephemeral databases, and Docker image build with GitHub Actions cache.
- `infra/docker-compose.test.yml`: ephemeral Postgres/Mongo stack with
  `tmpfs` backing for fast, deterministic test runs.
- Integration test suite under `app/tests/` with 14 cases covering
  health endpoints, PostgreSQL CRUD, MongoDB listing, geospatial
  `$geoNear` queries, API key authentication and uniform error
  responses. Real databases, no mocks, three deterministic seed
  fixtures.
- `integrationTest` helper wrapping `Deno.test` with sanitisers
  disabled for suites with module-level connection pools.
- `deno.json` extended with `fmt`, `lint`, `check`, `fmt:check` and
  `test` tasks and explicit formatter/linter configuration.
- Makefile targets: `fmt`, `fmt-check`, `lint`, `check`, `test`,
  `test-up`, `test-down`.
- README badges for CI status and licence.

### Changed

- Existing codebase reformatted with `deno fmt` using the project's
  pinned configuration (100-char line width, semicolons, double
  quotes).
- CI triggers configured for `main` and `tfc/**` branches, with
  `workflow_dispatch` for manual runs and an explicit `concurrency`
  group to cancel superseded in-flight runs.

### Fixed

- Test harness now binds to `127.0.0.1` explicitly to avoid IPv6
  resolution issues on Ubuntu runners.

## [0.5.0] - 2026-04-21

### Added

- Multi-stage `Dockerfile` for the app (Deno 2.7.12 alpine), running as
  the non-root `deno` user with explicit permission flags.
- `app/.dockerignore` to exclude secrets, local data and dev artifacts
  from the build context.
- `infra/docker-compose.yml` orchestrating `app`, `postgres:16-alpine`
  and `mongo:7` with healthchecks, internal networking and
  loopback-only port publishing for the API.
- Profile-gated one-shot loaders (`import-pg`, `import-mongo`) for
  seeding both databases from inside the compose network.
- Root `.env.example` template documenting all required environment
  variables.
- Liveness (`/health`) and readiness (`/health/ready`) endpoints with
  per-engine dependency reporting.
- JSON structured request logger with `X-Request-ID` header
  generation and propagation.
- Fail-fast validation of required environment variables at startup
  (`app/src/lib/env.ts`).
- Uniform error response format `{ error: { code, message } }` across
  every handler.
- `infra/README.md` documenting stack operation.
- ADR-0002 (Deno as the application runtime), ADR-0003 (Hono as the
  web framework), ADR-0004 (PostgreSQL and MongoDB coexistence).
- Automatic creation of the `2dsphere` MongoDB index at the end of
  the import script (previously a manual step documented in the
  README).

### Changed

- `app/scripts/import_pg.ts` and `app/scripts/import_mongo.ts` now
  consume the validated environment module and accept a `DATA_PATH`
  override, so they can run either locally or inside a one-shot
  container.
- Root `Makefile` extended with Compose-oriented targets (`build`,
  `up`, `down`, `restart`, `logs`, `ps`, `fetch-data`, `seed-pg`,
  `seed-mongo`, `seed`, `clean`).
- `deno.lock` regenerated against Deno 2.7.12 to close drift from the
  lockfile format used during the Erasmus+ placement.

### Security

- Application container runs as non-root (`USER deno`, UID 1993).
- Least-privilege runtime: `--cached-only --allow-net --allow-env
--allow-read=.`, no `--allow-all`.
- `API_KEY` and `DB_PASSWORD` are required at startup; silent
  fallbacks have been removed.
- Database services no longer publish ports to the host; they are
  reachable only inside the compose network.

## [0.4.1] - 2026-04-21

### Added

- MongoDB endpoints (`/api/mongo/trees`, `/api/mongo/trees/:id`,
  `/api/mongo/trees/nearby`, `/api/mongo/statistics/neighborhoods`,
  `POST /api/mongo/trees`) with `$geoNear` geospatial aggregation.
- API key authentication middleware (`x-api-key` header) protecting
  write operations on both PostgreSQL and MongoDB routers.
- OpenAPI 3.0.3 specification (`app/docs/openapi.json`) and Swagger UI
  served at `/docs`, including `ApiKeyAuth` declarations and
  `401 Unauthorized` responses on all write endpoints.
- MongoDB endpoints and authentication test cases in the Postman
  collection; collection reorganised into `PostgreSQL` and `MongoDB`
  folders with a dedicated `apiKey` variable.
- Repository restructured into `/app`, `/infra`, `/scripts` and
  `/docs-tfc` to accommodate the TFC infrastructure work (see
  ADR-0001).
- `LICENSE` (MIT), `SECURITY.md`, `CHANGELOG.md`, `.gitattributes`
  and root `Makefile`.
- Dependabot configuration for GitHub Actions workflows.
- `docs-tfc/adr/` directory with MADR template and first ADR.

### Changed

- `app/data/baumkataster.json` is no longer tracked in git (it was
  already listed in `.gitignore`).

<!--
Template for future releases:

## [X.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
-->
