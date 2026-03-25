import { createMiddleware } from "hono/factory";

export const apiKeyAuth = createMiddleware(async (c, next) => {
  const key = c.req.header("x-api-key");
  if (!key || key !== Deno.env.get("API_KEY")) {
    return c.json({ error: "Not authorized" }, 401);
  }
  await next();
});
