import { createMiddleware } from "hono/factory";

/**
 * Request logger middleware.
 *
 * - Reads an incoming `X-Request-ID` header if present, otherwise mints a
 *   fresh UUID. Propagates it back in the response header so clients and
 *   upstream proxies (Nginx, OPNsense logs) can correlate requests.
 * - Emits a single JSON log line per request after the response is built.
 */
export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const durationMs = Math.round(performance.now() - start);
  const status = c.res.status;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      requestId,
      method,
      path,
      status,
      durationMs,
    }),
  );
});
