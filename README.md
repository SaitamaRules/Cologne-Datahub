# Cologne DataHub

[![CI](https://github.com/SaitamaRules/Cologne-Datahub/actions/workflows/ci.yml/badge.svg)](https://github.com/SaitamaRules/Cologne-Datahub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project was developed during my Erasmus+ mobility in Cologne (ASIR Higher Degree). The goal is to work with real spatial data from the city's tree registry and build a backend around it.

## Description

The city of Cologne has a public tree registry (Baumkataster) available as a WFS service. It has data on every publicly managed tree: species, size, planting year, neighborhood, street, coordinates... about 58 MB of GeoJSON in total.

The project is split into weekly stages:

- **Week 1** — Fetched the GeoJSON from the WFS, designed a relational schema, imported everything into PostgreSQL and wrote SQL queries.
- **Week 2** — Built a REST API with Deno and Hono to expose the PostgreSQL data. Full CRUD + stats endpoints, tested with Postman.
- **Week 3** — Imported the same data into MongoDB without any transformation, ran geospatial queries, and wrote a comparison between both databases.
- **Week 4** — Added MongoDB endpoints to the API (including a geo query), protected write operations with API key authentication, and wrote OpenAPI documentation.

**WFS Source:** [Cologne Tree Registry (GeoJSON)](https://geoportal.stadt-koeln.de/wss/service/baumkataster_extern_wfs/guest?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms:baumkataster&outputFormat=application/json;%20subtype=geojson)

## Requirements

- Deno 2.x
- PostgreSQL 15+
- MongoDB 7.x
- Git

## Setup

Clone the repo:

```bash
git clone https://github.com/SaitamaRules/Cologne-Datahub.git
cd Cologne-Datahub/app
```

Create a .env file here (inside app/):

```
DB_HOST=localhost
DB_NAME=cologne_datahub
DB_USER=postgres
DB_PASSWORD=your_password
DB_PORT=5432
MONGO_URI=mongodb://localhost:27017
API_KEY=your_secret_key
```

### PostgreSQL

Create the database, run the schema and import:

```bash
createdb cologne_datahub
psql -d cologne_datahub -f queries/schema.sql
deno run --allow-net --allow-write scripts/fetch_data.ts
deno run --allow-read --allow-net --allow-env scripts/import_pg.ts
```

### MongoDB

Make sure `mongod` is running, then:

```bash
deno run --allow-read --allow-net scripts/import_mongo.ts
```

After importing, create the geo index:

```js
use cologne_datahub
db.arboles.createIndex({ geometry: "2dsphere" })
```

### Run the API

```bash
deno task dev
```

Starts on `http://localhost:8000`.

## API Endpoints

### PostgreSQL

| Method | Endpoint                        | Description                                            |
| ------ | ------------------------------- | ------------------------------------------------------ |
| GET    | `/api/trees`                    | All trees (`?page=1&limit=20`, `?neighborhood=Nippes`) |
| GET    | `/api/trees/:id`                | Single tree by ID                                      |
| POST   | `/api/trees`                    | Create a tree                                          |
| PUT    | `/api/trees/:id`                | Update a tree                                          |
| DELETE | `/api/trees/:id`                | Delete a tree                                          |
| GET    | `/api/statistics/neighborhoods` | Tree count per neighborhood                            |
| GET    | `/api/statistics/species`       | Top 10 species                                         |

### MongoDB

| Method | Endpoint                              | Description                                  |
| ------ | ------------------------------------- | -------------------------------------------- |
| GET    | `/api/mongo/trees`                    | All trees (`?page=1&limit=20`)               |
| GET    | `/api/mongo/trees/:id`                | Single tree by MongoDB `_id`                 |
| GET    | `/api/mongo/trees/nearby`             | Geo query (`?lat=50.94&lon=6.95&radius=500`) |
| GET    | `/api/mongo/statistics/neighborhoods` | Tree count per neighborhood                  |
| POST   | `/api/mongo/trees`                    | Create a tree (GeoJSON Feature)              |

### Authentication

Write operations (POST, PUT, DELETE) require an API key. Send it as a header:

```
x-api-key: your_secret_key
```

GET endpoints are public.

### API Documentation

With the server running, open `http://localhost:8000/docs` for the interactive Swagger UI.

## Project Structure

```
Cologne-Datahub/
├── app/                   # Application (Erasmus+ deliverable)
│   ├── src/
│   │   ├── main.ts        # Entry point
│   │   ├── db.ts          # PostgreSQL connection
│   │   ├── mongo_db.ts    # MongoDB connection
│   │   ├── middleware/
│   │   │   └── auth.ts    # API key middleware
│   │   └── routes/
│   │       ├── arboles.ts         # PostgreSQL routes
│   │       └── arboles_mongo.ts   # MongoDB routes
│   ├── queries/           # schema.sql, queries_pg.sql, queries_mongo.js
│   ├── scripts/           # fetch_data.ts, import_pg.ts, import_mongo.ts
│   ├── docs/              # openapi.json, swagger.html
│   ├── tests/             # Postman collection
│   ├── data/              # Local data files (gitignored)
│   ├── deno.json
│   └── deno.lock
├── docs-tfc/              # TFC documentation
│   ├── DIARY.md           # Progress journal
│   └── adr/               # Architecture Decision Records
├── infra/                 # Infrastructure (TFC, Phase 1+)
├── scripts/               # Operational scripts (TFC, Phase 8+)
├── LICENSE
├── SECURITY.md
├── CHANGELOG.md
├── Makefile
└── README.md
```

## Issues I ran into

- The university firewall blocked the WFS connection. Had to use a mobile hotspot.
- Importing 58 MB into MongoDB with a single `insertMany()` crashed. Fixed it by batching in groups of 500.
- The WFS coordinates are in EPSG:25832 (meters), not WGS84 (degrees). MongoDB needs WGS84 for the `2dsphere` index, so I used `proj4` to convert them before inserting.

---

## 🇪🇸 Apéndice Académico: Proyecto Final ASIR

_Nota: Esta sección está redactada en español, ya que documenta el uso de este repositorio para mi evaluación académica en España._

Este código base, desarrollado originalmente durante mi movilidad Erasmus+ en Colonia, sirve como núcleo para mi **Trabajo de Fin de Ciclo (TFC)** del Grado Superior en Administración de Sistemas Informáticos en Red (ASIR).

El objetivo del proyecto final no es solo el código, sino el diseño, despliegue y securización de toda la infraestructura que lo soporta (implementando un firewall OPNsense, DMZ/LAN segmentadas, orquestación con Docker, Proxy Inverso con Nginx y monitorización nativa en Python).

Puedes consultar la planificación completa, los objetivos y la arquitectura de sistemas en el siguiente enlace:

📄 **[Ver Anteproyecto de Infraestructura (Notion)](https://cologne-datahub.notion.site/Cologne-Datahub-32dd13355df8804db043f28942998cc6?pvs=141)**
