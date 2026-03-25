import { Hono } from "hono";
import { apiRouter } from "./routes/arboles.ts";
import { mongoRouter } from "./routes/arboles_mongo.ts";
import { serveStatic } from "hono/deno";

const app = new Hono();

// montar todas las rutas bajo el prefijo /api
app.route("/api", apiRouter);
app.route("/api/mongo", mongoRouter);

app.get("/docs/openapi.json", serveStatic({ path: "./docs/openapi.json" }));
app.get("/docs", serveStatic({ path: "./docs/swagger.html" }));

Deno.serve({ port: 8000 }, app.fetch);
