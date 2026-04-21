# Tests

Integration tests for the Cologne DataHub API.

## Strategy

Tests run against real PostgreSQL and MongoDB instances — no mocks. The
databases are ephemeral (`tmpfs`-backed containers spun up only for the
test run) and pre-seeded with three deterministic fixtures defined in
`helpers.ts`. Each test calls `setup()` which resets state, boots the
Hono app in-process on an ephemeral port, and returns a base URL.

## Running locally

From the repository root, start the test databases:

```bash
docker compose -f infra/docker-compose.test.yml up -d --wait
```

Then, from `app/`, run the suite:

```bash
# Native:
deno test --allow-net --allow-env --allow-read

# Or containerised (Windows, no Deno installed):
docker run --rm --network host \
  -v "${PWD}:/app" -w /app \
  --entrypoint deno \
  denoland/deno:alpine-2.7.12 \
  test --allow-net --allow-env --allow-read
```

After the suite finishes, shut down the test stack:

```bash
docker compose -f infra/docker-compose.test.yml down -v
```

## Ports

The test stack uses non-default ports to avoid conflicting with the
main stack:

- PostgreSQL: `localhost:5433` (main stack uses `5432` internally only)
- MongoDB: `localhost:27018` (main stack uses `27017` internally only)

## Adding new tests

Create `<name>_test.ts` inside this directory. Import `setup` from
`./helpers.ts`, call it at the top of each `Deno.test` block, and
always call `ctx.stop()` in a `finally`. The seeded fixtures are
exported as `SEED_TREES` if you need to assert against them.
