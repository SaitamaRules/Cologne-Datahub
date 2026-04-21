# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
