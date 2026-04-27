# Cologne DataHub

[![CI](https://github.com/SaitamaRules/Cologne-Datahub/actions/workflows/ci.yml/badge.svg)](https://github.com/SaitamaRules/Cologne-Datahub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Latest release](https://img.shields.io/github/v/tag/SaitamaRules/Cologne-Datahub?label=release&sort=semver)](https://github.com/SaitamaRules/Cologne-Datahub/tags)

This project was developed during my Erasmus+ mobility in Cologne (ASIR Higher Degree) and continues as my Final Year Project (TFC).

It takes the REST API I built at the ZfL (University of Cologne) — serving public tree registry data from the city — and grows it into a full production-style system with segmented networking, TLS, internal DNS, rate limiting, CI, backups and monitoring.

**Data source:** [Cologne Tree Registry (GeoJSON/WFS)](https://geoportal.stadt-koeln.de/)

## Status

**7 of 10 phases completed.** The latest release covers internal DNS with BIND9, on top of the proxy with TLS and L7 rate limiting from previous phases. Remaining phases tackle the OPNsense perimeter (DMZ/LAN split), automated backups, monitoring and the final report.

Full breakdown in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Quickstart

Requirements: Docker Desktop or Docker Engine with Compose v2.

```bash
git clone https://github.com/SaitamaRules/Cologne-Datahub.git
cd Cologne-Datahub
cp .env.example .env
# Edit .env — set DB_PASSWORD and API_KEY to your own values.

# Generate the internal CA and server certificate (one-off, ~5 seconds).
docker run --rm -v "$PWD/infra/certs:/work" -w /work \
    --entrypoint sh alpine/openssl generate-certs.sh

# Bring up the stack.
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
```

The API is reachable through the Nginx proxy. HTTP redirects to HTTPS; the certificate is signed by the internal CA you just generated, so pass it to `curl` with `--cacert`:

```bash
curl --cacert infra/certs/out/ca.crt https://localhost/health
curl --cacert infra/certs/out/ca.crt https://localhost/health/ready
curl --cacert infra/certs/out/ca.crt "https://localhost/api/trees?limit=3"   # After seeding data
```

Interactive API docs (Swagger UI): <https://localhost/docs>

To stop: `docker compose -f infra/docker-compose.yml --env-file .env down`

Seeding real data from the Cologne WFS, running tests against ephemeral databases, and trusting the CA system-wide are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`infra/certs/README.md`](infra/certs/README.md).

## Documentation map

- **[API reference](docs/API.md)** — every endpoint, authentication, error format.
- **[Architecture](docs/ARCHITECTURE.md)** — stack, data flow, repo layout, seeding instructions.
- **[Roadmap](docs/ROADMAP.md)** — phase-by-phase breakdown and what each delivers.
- **[Bibliography](docs/BIBLIOGRAPHY.md)** — data sources, tooling, standards.
- **[Changelog](CHANGELOG.md)** — versioned history of every change.
- **[Architecture Decision Records](docs-tfc/adr/)** — why each major choice was made.
- **Subsystem docs:** [Nginx](infra/nginx/README.md) · [Rate limits](infra/nginx/RATE_LIMITS.md) · [Internal CA](infra/certs/README.md) · [BIND9](infra/bind9/README.md)

## Continuous Integration

Every push to `main` or a `tfc/**` branch runs four parallel jobs: lint and typecheck, integration tests against real ephemeral databases (no mocks), Docker image build with GHA layer cache, and a full end-to-end run of the stack that asserts internal DNS resolution, the HTTP→HTTPS redirect, the HSTS header, `X-Request-ID` round-trip, deny-by-default on unknown paths, that TLS 1.0 is rejected, and that the rate limiter rejects burst traffic with `429`.

The complete workflow lives in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

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

### 🎬 Vídeo de presentación del checkpoint

Presentación de 4 minutos y medio del estado del proyecto en el checkpoint intermedio: fases completadas, demo en vivo de la API y hoja de ruta pendiente.

📹 **[Ver vídeo (YouTube)](https://youtu.be/XPgJadHXoes)**
