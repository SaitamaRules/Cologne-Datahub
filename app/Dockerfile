# syntax=docker/dockerfile:1.7

# Pinned for reproducibility. Bump deliberately, never by accident.
ARG DENO_VERSION=2.7.12

# ---------- Stage 1: builder — resolve, cache, typecheck ----------
FROM denoland/deno:alpine-${DENO_VERSION} AS builder

WORKDIR /app

# Manifest first so Docker's layer cache survives code-only changes
COPY deno.json deno.lock ./

# Then the source tree and statically served docs
COPY src ./src
COPY docs ./docs

# Cache all imports honouring deno.lock exactly, then typecheck.
# --frozen fails the build on any drift between deno.json and deno.lock.
RUN deno cache --frozen src/main.ts \
 && deno check src/main.ts

# ---------- Stage 2: runtime ----------
FROM denoland/deno:alpine-${DENO_VERSION} AS runtime

# The official image ships a non-root `deno` user (UID 1993).
USER deno

WORKDIR /app

# Bring across the populated Deno module cache built in stage 1
COPY --from=builder --chown=deno:deno /deno-dir /deno-dir

# And the application itself
COPY --from=builder --chown=deno:deno /app /app

EXPOSE 8000

# Least-privilege permissions by design:
#   --cached-only    no network fetch of modules at runtime
#   --allow-net      HTTP server + outbound to Postgres and Mongo
#   --allow-env      read validated env vars
#   --allow-read=.   serveStatic for OpenAPI docs + optional dotenv load
CMD ["deno", "run", \
     "--cached-only", \
     "--allow-net", \
     "--allow-env", \
     "--allow-read=.", \
     "src/main.ts"]
