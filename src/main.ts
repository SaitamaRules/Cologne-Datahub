import { Hono } from "hono";
import { apiRouter } from "./routes/arboles.ts";

const app = new Hono();

// montar todas las rutas bajo el prefijo /api
app.route('/api', apiRouter);

Deno.serve({ port: 8000 }, app.fetch);
