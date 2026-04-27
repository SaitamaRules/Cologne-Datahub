# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
