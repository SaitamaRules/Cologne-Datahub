# 0003. Hono as the web framework

- Status: accepted
- Date: 2026-04-21
- Deciders: Francisco
- Tags: framework, application

## Context and Problem Statement

As with the runtime, the web framework was set by the ZfL during the
Erasmus+ placement: new APIs in their stack are written with Hono on
top of Deno. The TFC inherits that choice. This ADR records the
reasons to keep Hono rather than swap it for something else now that
the project is outside the placement context.

## Decision Drivers

- The application is small: a handful of routes, two middlewares
  (authentication and logging), static files for the OpenAPI docs.
  Whatever framework I use, it needs to stay out of the way.
- Hono supports Deno as a first-class target, not as an afterthought.
  The `hono/deno` entry point gives me the static file helper and the
  server adapter out of the box.
- The code written at the ZfL works and has been reviewed there. A
  rewrite for the TFC would only introduce risk of regressions for no
  gain.
- Middleware composition needs to be clean enough that the API-key
  check and the request logger can live as separate, reusable pieces.

## Considered Options

- **Option A** — Keep Hono 4.x.
- **Option B** — Rewrite on Oak.
- **Option C** — Drop the framework and use only the Deno standard
  library (`Deno.serve` + manual routing).

## Decision Outcome

Chosen option: "**Option A — keep Hono 4.x**". Like the runtime
decision, this is partly inherited from the placement and partly a
choice I would make on my own: Hono is small, reads well, and
integrates with Deno without friction.

### Positive Consequences

- The handlers in `arboles.ts` and `arboles_mongo.ts` stay short and
  readable. A reviewer can follow a request end to end without
  hunting through framework internals.
- `createMiddleware` is the same primitive behind the API-key
  middleware and the request logger. The two layers look consistent.
- `serveStatic` from `hono/deno` replaces what would otherwise be a
  manual file read for the OpenAPI JSON and the Swagger HTML.
- If the project ever moved to another runtime (Bun, Node, workers),
  Hono would follow. The framework is not a lock-in point.

### Negative Consequences

- One more external dependency to trust and track.
- Hono releases often. I have pinned the version in `deno.json` and
  will upgrade deliberately rather than automatically.

## Pros and Cons of the Options

### Option A — Hono 4.x

- Good, because the code that already works stays.
- Good, because Deno support is first-class.
- Good, because middlewares compose cleanly.
- Bad, because it adds a dependency that the standard library alone
  would avoid.

### Option B — Oak

- Good, because it is mature and Deno-native.
- Bad, because its Koa-style API is more verbose than Hono's for the
  same endpoints, and adopting it would mean rewriting working code.

### Option C — Standard library only

- Good, because the only dependencies left would be the database
  drivers.
- Bad, because I would be reimplementing routing, parameter parsing
  and middleware from scratch. That code is easy to get wrong in
  subtle ways, and a well-known framework has already solved it.
- Bad, because the handlers would become longer and less idiomatic.

## Links

- `app/src/main.ts` — framework wiring and middleware registration.
- `app/src/middleware/auth.ts` — API-key middleware.
- `app/src/middleware/logger.ts` — structured request logger.
- ADR-0002 — Deno as the application runtime.
