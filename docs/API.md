# API Reference

All API traffic goes through the Nginx reverse proxy on port 80. The application itself is not directly reachable from the host.

## Base URL

- Local development: `http://localhost`
- After Phase 4 (TLS): `https://cologne-datahub.local`

## Authentication

Write operations (`POST`, `PUT`, `DELETE`) require an API key sent as an HTTP header:

```
x-api-key: <value-from-API_KEY-env-var>
```

Read operations (`GET`) are public.

## PostgreSQL-backed endpoints

| Method | Path                            | Description                                                                  |
| ------ | ------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/trees`                    | Paginated listing. Query params: `page`, `limit`, `neighborhood`, `species`. |
| GET    | `/api/trees/:id`                | Fetch a single tree by its numeric ID.                                       |
| POST   | `/api/trees`                    | Create a tree (auth required).                                               |
| PUT    | `/api/trees/:id`                | Update a tree (auth required).                                               |
| DELETE | `/api/trees/:id`                | Delete a tree (auth required).                                               |
| GET    | `/api/statistics/neighborhoods` | Total trees per neighborhood.                                                |
| GET    | `/api/statistics/species`       | Top 10 species across the dataset.                                           |

## MongoDB-backed endpoints

| Method | Path                                  | Description                                                                              |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/mongo/trees`                    | Paginated listing of GeoJSON features.                                                   |
| GET    | `/api/mongo/trees/:id`                | Fetch a single feature by its ObjectId.                                                  |
| GET    | `/api/mongo/trees/nearby`             | Geospatial `$geoNear` query. Required params: `lat`, `lon`. Optional: `radius` (metres). |
| GET    | `/api/mongo/statistics/neighborhoods` | Aggregation: tree counts per neighborhood.                                               |
| POST   | `/api/mongo/trees`                    | Create a feature (auth required). Body must be a valid GeoJSON Feature.                  |

## System endpoints

| Method | Path                 | Description                                                                      |
| ------ | -------------------- | -------------------------------------------------------------------------------- |
| GET    | `/health`            | Liveness of the application process.                                             |
| GET    | `/health/ready`      | Readiness: reports connectivity to PostgreSQL and MongoDB separately.            |
| GET    | `/nginx-health`      | Liveness of the proxy itself (served directly by Nginx, does not touch the app). |
| GET    | `/docs`              | Swagger UI.                                                                      |
| GET    | `/docs/openapi.json` | OpenAPI 3.0 specification.                                                       |

## Request correlation

Every request carries an `X-Request-ID` header. If the client sends one, it is honoured and forwarded end-to-end (Nginx → app → response). If not, Nginx generates one. The application logs include this ID, so a single request can be traced across both proxy and app logs.

## Error format

All 4xx and 5xx responses share a uniform JSON body:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid x-api-key header"
  }
}
```

Current error codes: `UNAUTHORIZED` (401), `VALIDATION_ERROR` (422), `INVALID_PAGINATION` (400), `INVALID_ID` (400), `INVALID_JSON` (400), `EMPTY_BODY` (400), `TREE_NOT_FOUND` (404), `DATABASE_ERROR` (500).
