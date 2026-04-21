import { Hono } from "hono";
import { pool } from "../db.ts";
import { arbolesMongo } from "../mongo_db.ts";

export const healthRouter = new Hono();

/**
 * Liveness probe.
 * Returns 200 if the process is running and can serve HTTP.
 * Consumed by Docker HEALTHCHECK and external monitors.
 */
healthRouter.get("/health", (c) => {
  return c.json({ status: "ok" });
});

/**
 * Readiness probe.
 * Verifies that downstream dependencies (PostgreSQL, MongoDB) are
 * reachable. Returns 200 when everything is up, 503 otherwise, with
 * a per-dependency breakdown.
 */
healthRouter.get("/health/ready", async (c) => {
  const checks: { postgres: "ok" | "fail"; mongo: "ok" | "fail" } = {
    postgres: "fail",
    mongo: "fail",
  };

  // PostgreSQL: SELECT 1
  try {
    const client = await pool.connect();
    try {
      await client.queryObject("SELECT 1");
      checks.postgres = "ok";
    } finally {
      client.release();
    }
  } catch (_err) {
    checks.postgres = "fail";
  }

  // MongoDB: minimal round-trip
  try {
    await arbolesMongo.findOne({});
    checks.mongo = "ok";
  } catch (_err) {
    checks.mongo = "fail";
  }

  const allOk = checks.postgres === "ok" && checks.mongo === "ok";
  return c.json(
    { status: allOk ? "ok" : "degraded", checks },
    allOk ? 200 : 503,
  );
});
