# Nginx

Reverse-proxy configuration used by the `nginx` service in the main
compose stack.

## Layout

- `nginx.conf` — top-level configuration. Defines the upstream, the
  virtual server, JSON access logs and the set of proxied routes.
- `snippets/proxy.conf` — common `proxy_*` directives, included from
  each proxied `location` block to avoid drift.

## Routes

| Path                 | Target           | Notes                                  |
| -------------------- | ---------------- | -------------------------------------- |
| `/api/*`             | app:8000         | Application API (PG + Mongo routers).  |
| `/health`            | app:8000/health  | Liveness probe (proxied).              |
| `/health/ready`      | app:8000/ready   | Readiness probe (proxied).             |
| `/docs`              | app:8000/docs    | Swagger UI + OpenAPI JSON.             |
| `/nginx-health`      | (edge)           | Served by Nginx itself, 200 OK.        |
| everything else      | —                | `404` at the edge.                     |

## Request ID

The proxy honours an incoming `X-Request-ID` header if the client
provides one, otherwise it generates a fresh ID (`$request_id`) and
forwards it to the application. The application then echoes it back
in its own response header. This allows end-to-end correlation in the
access logs of both layers.

## Future work

- Phase 4 — TLS termination with an internally-issued certificate.
- Phase 5 — L7 rate limiting (`limit_req_zone`, `limit_conn`).
