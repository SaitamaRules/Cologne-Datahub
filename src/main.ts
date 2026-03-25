import { Hono } from "hono";
import { apiRouter } from "./routes/arboles.ts";
import { mongoRouter } from "./routes/arboles_mongo.ts";

const app = new Hono();

// montar todas las rutas bajo el prefijo /api
app.route("/api", apiRouter);
app.route("/api/mongo", mongoRouter);

Deno.serve({ port: 8000 }, app.fetch);
