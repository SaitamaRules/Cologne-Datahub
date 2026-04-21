# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
