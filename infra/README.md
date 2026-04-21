# Infrastructure

Docker Compose stack for Cologne DataHub.

## Contents

- `docker-compose.yml` — application stack (`app`, `postgres`, `mongo`) plus
  profile-gated one-shot loaders (`import-pg`, `import-mongo`).

## Usage

All targets are exposed through the root `Makefile`. From the repository root:

```
make build        # Build the app image
make up           # Start the stack
make ps           # Check status
make logs         # Follow logs
make down         # Stop (preserves data)
make clean        # Stop and delete volumes (destructive)
```

To seed the databases (requires `app/data/baumkataster.json`):

```
make fetch-data   # Pull the 500-feature sample from the Cologne WFS
make seed         # Import into both PostgreSQL and MongoDB
```

## Environment

The stack reads its configuration from `.env` in the repository root.
See `.env.example` at the repository root for the full list of variables.

## Ports

The `app` service binds to `127.0.0.1:8000` on the host. The databases are
intentionally not published to the host; they are reachable only from within
the compose network by service name (`postgres:5432`, `mongo:27017`).
