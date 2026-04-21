import type { Context } from "hono";

/**
 * Status codes explicitly used by this API.
 * Kept as an inline union to avoid deep imports into Hono's internal paths.
 */
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

/**
 * Uniform error response:
 *   { error: { code: "MACHINE_READABLE_CODE", message: "human-readable text" } }
 *
 * `code` is stable and can be matched by clients; `message` may change freely.
 */
export function jsonError(
  c: Context,
  status: ErrorStatus,
  code: string,
  message: string,
) {
  return c.json({ error: { code, message } }, status);
}
