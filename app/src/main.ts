import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { apiRouter } from "./routes/arboles.ts";
import { mongoRouter } from "./routes/arboles_mongo.ts";
import { healthRouter } from "./routes/health.ts";
import { requestLogger } from "./middleware/logger.ts";
import { env } from "./lib/env.ts";

const app = new Hono();

// Global middleware
app.use("*", requestLogger);

// Rutas
app.route("/", healthRouter);
app.route("/api", apiRouter);
app.route("/api/mongo", mongoRouter);

// Documentación estática (OpenAPI + Swagger UI)
app.get("/docs/openapi.json", serveStatic({ path: "./docs/openapi.json" }));
app.get("/docs", serveStatic({ path: "./docs/swagger.html" }));

console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    msg: `Server listening on http://0.0.0.0:${env.PORT}`,
  }),
);

Deno.serve({ port: env.PORT, hostname: "0.0.0.0" }, app.fetch);
