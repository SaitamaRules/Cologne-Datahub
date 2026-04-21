import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { integrationTest, setup } from "./helpers.ts";

integrationTest("GET /health returns 200", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/health`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.status, "ok");
  } finally {
    await ctx.stop();
  }
});

integrationTest("GET /health/ready reports both engines healthy", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/health/ready`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.status, "ok");
    assertEquals(body.checks.postgres, "ok");
    assertEquals(body.checks.mongo, "ok");
  } finally {
    await ctx.stop();
  }
});

integrationTest("response carries X-Request-ID header", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/health`);
    await res.body?.cancel();
    const header = res.headers.get("X-Request-ID");
    // UUID v4 format: 8-4-4-4-12 hex chars
    if (
      !header || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(header)
    ) {
      throw new Error(`Invalid or missing X-Request-ID header: ${header}`);
    }
  } finally {
    await ctx.stop();
  }
});
