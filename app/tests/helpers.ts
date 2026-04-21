// Integration test harness.
//
// Each test imports `setup()`, `teardown()` and `integrationTest` from here.
// `setup()` boots the real Hono app on an ephemeral port against the test
// databases, reseeds them deterministically, and returns a base URL.
// `teardown()` closes everything. No mocks — the DBs are real, just small.
//
// `integrationTest` is a thin wrapper over `Deno.test` that disables
// resource and op sanitizers, because `db.ts` and `mongo_db.ts` maintain
// connection pools at module level that persist across tests (by design).

import { MongoClient } from "mongo";
import { Client as PgClient } from "postgres";

// --- Test environment wiring -------------------------------------------------
// Must be set before importing anything from the app, because env.ts
// validates required vars at module load time.
Deno.env.set("DB_HOST", "127.0.0.1");
Deno.env.set("DB_PORT", "5433");
Deno.env.set("DB_NAME", "cologne_datahub_test");
Deno.env.set("DB_USER", "test");
Deno.env.set("DB_PASSWORD", "test");
Deno.env.set("MONGO_URI", "mongodb://127.0.0.1:27018");
Deno.env.set("API_KEY", "test-api-key");
Deno.env.set("PORT", "0"); // ignored — we pass our own below

// --- Deterministic seed data -------------------------------------------------
export const SEED_TREES = [
  {
    tree_number: "S00001",
    botanical_name: "Tilia cordata",
    planting_year: 2015,
    trunk_circumference_cm: 80,
    height_m: 12,
    street: "Aachener Str.",
    neighborhood: "Lindenthal",
    natural_monument: false,
    lat: 50.9333,
    lon: 6.9167,
  },
  {
    tree_number: "S00002",
    botanical_name: "Quercus robur",
    planting_year: 1980,
    trunk_circumference_cm: 250,
    height_m: 22,
    street: "Domkloster",
    neighborhood: "Altstadt-Nord",
    natural_monument: true,
    lat: 50.9413,
    lon: 6.9578,
  },
  {
    tree_number: "S00003",
    botanical_name: "Acer platanoides",
    planting_year: 2000,
    trunk_circumference_cm: 120,
    height_m: 15,
    street: "Severinstr.",
    neighborhood: "Altstadt-Süd",
    natural_monument: false,
    lat: 50.93,
    lon: 6.96,
  },
] as const;

// --- Seeders -----------------------------------------------------------------
async function resetPostgres() {
  const client = new PgClient({
    hostname: "127.0.0.1",
    port: 5433,
    database: "cologne_datahub_test",
    user: "test",
    password: "test",
  });
  await client.connect();
  try {
    await client.queryObject(
      "TRUNCATE trees, neighborhoods RESTART IDENTITY CASCADE",
    );

    for (const t of SEED_TREES) {
      const { rows } = await client.queryObject<{ id: number }>(
        `INSERT INTO neighborhoods (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [t.neighborhood],
      );
      const neighborhoodId = rows[0].id;

      await client.queryObject(
        `INSERT INTO trees (
          tree_number, botanical_name, planting_year,
          trunk_circumference_cm, height_m, street,
          neighborhood_id, lat, lon, natural_monument
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          t.tree_number,
          t.botanical_name,
          t.planting_year,
          t.trunk_circumference_cm,
          t.height_m,
          t.street,
          neighborhoodId,
          t.lat,
          t.lon,
          t.natural_monument,
        ],
      );
    }
  } finally {
    await client.end();
  }
}

async function resetMongo() {
  const client = new MongoClient();
  await client.connect("mongodb://127.0.0.1:27018");
  try {
    const coll = client.database("cologne_datahub").collection("arboles");
    await coll.deleteMany({});

    const docs = SEED_TREES.map((t) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [t.lon, t.lat] },
      properties: {
        botanischer_name: t.botanical_name,
        pflanzjahr: t.planting_year,
        stammumfang: t.trunk_circumference_cm,
        baumhoehe: t.height_m,
        strasse: t.street,
        stadtteil: t.neighborhood,
        naturdenkmal: t.natural_monument ? "ja" : "nein",
      },
    }));
    await coll.insertMany(docs);

    await coll.createIndexes({
      indexes: [{ key: { geometry: "2dsphere" }, name: "geometry_2dsphere" }],
    });
  } finally {
    client.close();
  }
}

// --- Lifecycle ---------------------------------------------------------------
export interface TestContext {
  baseUrl: string;
  stop: () => Promise<void>;
  apiKey: string;
}

export async function setup(): Promise<TestContext> {
  await resetPostgres();
  await resetMongo();

  // Dynamic import AFTER env vars are set so env.ts validates correctly.
  const { Hono } = await import("hono");
  const { serveStatic } = await import("hono/deno");
  const { apiRouter } = await import("../src/routes/arboles.ts");
  const { mongoRouter } = await import("../src/routes/arboles_mongo.ts");
  const { healthRouter } = await import("../src/routes/health.ts");
  const { requestLogger } = await import("../src/middleware/logger.ts");

  const app = new Hono();
  app.use("*", requestLogger);
  app.route("/", healthRouter);
  app.route("/api", apiRouter);
  app.route("/api/mongo", mongoRouter);
  app.get("/docs/openapi.json", serveStatic({ path: "./docs/openapi.json" }));

  const server = Deno.serve({ port: 0, hostname: "127.0.0.1" }, app.fetch);
  const { port } = server.addr as Deno.NetAddr;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    apiKey: "test-api-key",
    stop: async () => {
      await server.shutdown();
    },
  };
}

// --- integrationTest wrapper -------------------------------------------------
// The app keeps module-level connection pools (see app/src/db.ts and
// app/src/mongo_db.ts) that intentionally outlive individual tests. Deno's
// default sanitizers flag these as leaks, so we disable them for this suite.
// This is the standard pattern for integration tests with real databases.
export function integrationTest(name: string, fn: () => Promise<void>) {
  Deno.test({
    name,
    fn,
    sanitizeResources: false,
    sanitizeOps: false,
  });
}
