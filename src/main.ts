// src/main.ts
import { Hono } from "hono";
import { apiRouter } from "./routes/arboles.ts";

const app = new Hono();

// Montar todas las rutas bajo el prefijo /api
app.route('/api', apiRouter);

Deno.serve({ port: 8000 }, app.fetch);
