import { createMiddleware } from "hono/factory";
import { env } from "../lib/env.ts";
import { jsonError } from "../lib/errors.ts";

export const apiKeyAuth = createMiddleware(async (c, next) => {
  const key = c.req.header("x-api-key");
  if (!key || key !== env.API_KEY) {
    return jsonError(c, 401, "UNAUTHORIZED", "Not authorized");
  }
  await next();
});
