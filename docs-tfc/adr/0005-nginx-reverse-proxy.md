# 0005. Nginx as the reverse proxy

- Status: accepted
- Date: 2026-04-22
- Deciders: Francisco
- Tags: infrastructure, networking

## Context and Problem Statement

Up to Phase 2 the application container was published directly on the
host. That shortcut is fine for a developer laptop but it will not
survive the rest of the TFC: Phase 4 needs TLS termination, Phase 5
needs L7 rate limiting, and Phase 7 puts the public entry point in a
DMZ separate from the application in the LAN. I need a component in
front of the app that can absorb all of that without touching the
application code. This ADR records the choice of that component.

## Decision Drivers

- Needs to terminate TLS in a later phase without adding logic to the
  Deno application.
- Needs to apply per-endpoint rate limits in Phase 5 without rewriting
  the handlers.
- Needs to be comfortable living alone in the DMZ while the app stays
  in the LAN (Phase 7).
- Needs to preserve the `X-Request-ID` header end to end, so logs in
  the proxy and the app can be correlated.
- The image has to be small and boot fast; the TFC runs several VMs
  on a laptop and every 100 MB counts.
- I want something I can explain to a tribunal without having to wave
  my hands: configuration must be readable and the feature set has to
  match what I actually use.

## Considered Options

- **Option A** — Nginx (stable, `nginx:alpine`).
- **Option B** — Caddy 2.
- **Option C** — Traefik 3.
- **Option D** — No proxy; expose the application directly and add
  TLS/rate-limit logic inside the Deno app.

## Decision Outcome

Chosen option: "**Option A — Nginx**". It is the reference reverse
proxy in the Linux world, its configuration maps cleanly onto what
the memoria will describe ("upstream block", "server block",
"location block"), and every feature I need across the remaining
phases is either built in or reachable via a one-line directive.

### Positive Consequences

- The config file reads top-to-bottom: one `upstream` pointing at the
  app, one `server` with a handful of `location` blocks, a shared
  snippet with the proxy headers. A reviewer can follow it without
  prior exposure to the tool.
- Phase 4 (TLS) is a `listen 443 ssl;` plus two `ssl_*` directives.
- Phase 5 (rate limiting) is `limit_req_zone` at http level and a
  `limit_req` directive inside each relevant location.
- `alpine` variant is small (~50 MB) and boots in well under a
  second.
- The request-ID propagation works in one direction thanks to
  `$request_id` and in both directions thanks to the logger in the
  app — I verified this end to end in the e2e smoke test.

### Negative Consequences

- The `docker-compose.yml` grows by one service and a health check.
- Nginx configuration is syntax-heavy and unforgiving; a missing
  semicolon stops the proxy from starting. Mitigated by the e2e job
  in CI which would catch the regression before merge.
- The official `nginx:alpine` image uses BusyBox tools; the healthcheck
  command has to be picked with that in mind (`nc -z 127.0.0.1 80`
  rather than `curl` or `wget`, which are not guaranteed).

## Pros and Cons of the Options

### Option A — Nginx

- Good, because it is the de facto standard and easy to defend in the
  oral.
- Good, because every future phase maps onto a small, well-known
  feature of the tool.
- Good, because the config is plain text and lives inside the repo.
- Bad, because its syntax has sharp edges and errors halt the proxy.

### Option B — Caddy 2

- Good, because it terminates TLS with automatic Let's Encrypt out of
  the box.
- Good, because `Caddyfile` syntax is much shorter than `nginx.conf`.
- Bad, because automatic TLS is not helpful in this project — the
  TFC explicitly demands an internally-issued certificate from a CA
  I control (Phase 4), which is exactly what Caddy tries to take off
  my hands.
- Bad, because fewer reviewers will be familiar with Caddy; a tribunal
  may ask why I did not pick the obvious option.

### Option C — Traefik 3

- Good, because service discovery through Docker labels is elegant
  and removes static configuration for dynamic stacks.
- Bad, because the stack here is fixed and small — dynamic discovery
  solves a problem I do not have.
- Bad, because the dashboard and configuration model would be one
  more thing to explain, for no benefit.

### Option D — No proxy

- Good, because fewer components.
- Bad, because TLS, rate limiting and the DMZ/LAN split would all
  have to live inside the application. That violates separation of
  concerns and bloats the part of the code that should be simple
  request handlers.
- Bad, because it gives up the ability to serve static content (the
  Swagger UI HTML, the OpenAPI JSON) from anywhere other than the
  app itself, missing a chance for a cleaner architecture.

## Links

- `infra/nginx/nginx.conf` — top-level proxy configuration.
- `infra/nginx/snippets/proxy.conf` — shared proxy directives.
- `infra/docker-compose.yml` — compose definition for the proxy service.
- `.github/workflows/ci.yml` — e2e job exercising the proxy in CI.
- ADR-0002 (runtime), ADR-0003 (framework), ADR-0004 (databases).
