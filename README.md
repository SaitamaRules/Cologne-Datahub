# Cologne DataHub

[![CI](https://github.com/SaitamaRules/Cologne-Datahub/actions/workflows/ci.yml/badge.svg)](https://github.com/SaitamaRules/Cologne-Datahub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project was developed during my Erasmus+ mobility in Cologne (ASIR Higher Degree) and continues as my Final Year Project (TFC).

It takes the REST API I built at the ZfL (University of Cologne) — serving public tree registry data from the city — and grows it into a full production-style system with segmented networking, TLS, CI, backups and monitoring.

**Data source:** [Cologne Tree Registry (GeoJSON/WFS)](https://geoportal.stadt-koeln.de/)

## 🎬 Checkpoint video

<!-- TODO: paste YouTube/Vimeo link here once uploaded -->

## Current status

The TFC is organised in 10 phases. Progress so far:

| Phase | Title                                   | Status         | Tag      |
| ----- | --------------------------------------- | -------------- | -------- |
| 0     | Baseline & repo professionalisation     | ✅ Done        | `v0.4.1` |
| 1     | Containerisation (Docker + Compose)     | ✅ Done        | `v0.5.0` |
| 2     | Continuous Integration (GitHub Actions) | ✅ Done        | `v0.6.0` |
| 3     | Reverse proxy (Nginx)                   | ✅ Done        | `v0.7.0` |
| 4     | TLS with internal CA (OpenSSL)          | 🟡 In progress | —        |
| 5–10  | See [ROADMAP](docs/ROADMAP.md)          | ⏳ Pending     | —        |

## Quickstart

Requirements: Docker Desktop or Docker Engine with Compose v2.

```bash
git clone https://github.com/SaitamaRules/Cologne-Datahub.git
cd Cologne-Datahub
cp .env.example .env
# Edit .env — set DB_PASSWORD and API_KEY to your own values.

docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```

The API is reachable through the Nginx proxy at `http://localhost`:

```bash
curl http://localhost/health                # App liveness (proxied)
curl http://localhost/health/ready          # Readiness: Postgres + Mongo
curl "http://localhost/api/trees?limit=3"   # After seeding data
```

Interactive API docs (Swagger UI): <http://localhost/docs>

To stop: `docker compose -f infra/docker-compose.yml --env-file .env down`

Full instructions (including seeding real data from the Cologne WFS and running against the test databases) are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation map

- **[API reference](docs/API.md)** — every endpoint, authentication, error format.
- **[Architecture](docs/ARCHITECTURE.md)** — stack, data flow, repo layout, seeding instructions.
- **[Roadmap](docs/ROADMAP.md)** — phase-by-phase breakdown and what each delivers.
- **[Bibliography](docs/BIBLIOGRAPHY.md)** — data sources, tooling, standards.
- **[Changelog](CHANGELOG.md)** — versioned history of every change.
- **[Architecture Decision Records](docs-tfc/adr/)** — why each major choice was made.

## Continuous Integration

Every push to `main` or a `tfc/**` branch runs four parallel jobs:

- **Lint & typecheck** — `deno fmt --check`, `deno lint`, `deno check`.
- **Integration tests** — 14 tests against real ephemeral PostgreSQL and MongoDB instances (no mocks).
- **Docker build** — Multi-stage, non-root image, with GHA layer cache.
- **End-to-end** — Spins up the full stack and validates the proxy: `X-Request-ID` round-trip, deny-by-default on unknown paths, readiness of both databases.

## Contributing

This is a personal academic project, but issues and suggestions from the ZfL and evaluating faculty are very welcome.

See [`SECURITY.md`](SECURITY.md) for responsible disclosure of security issues.

## License

MIT — see [`LICENSE`](LICENSE).

---

## 🇪🇸 Apéndice académico (ASIR)

Este repositorio se presenta como **Trabajo de Fin de Ciclo** del Grado Superior en Administración de Sistemas Informáticos en Red (ASIR). El código parte del proyecto desarrollado durante la movilidad Erasmus+ en el ZfL de la Universidad de Colonia, y el TFC consiste en extenderlo con toda la infraestructura que lo rodea: firewall, segmentación DMZ/LAN, orquestación, proxy inverso, TLS, backups y monitorización.

Toda la documentación técnica de este repositorio está en inglés para mantener la coherencia con el contexto Erasmus+. La planificación completa y el anteproyecto académico (en español) están disponibles aquí:

📄 **[Ver Anteproyecto de Infraestructura (Notion)](https://cologne-datahub.notion.site/Cologne-Datahub-32dd13355df8804db043f28942998cc6?pvs=141)**
