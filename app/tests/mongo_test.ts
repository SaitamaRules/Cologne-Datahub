import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { integrationTest, setup } from "./helpers.ts";

integrationTest("GET /api/mongo/trees lists seeded documents", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/mongo/trees?page=1&limit=10`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.data.length, 3);
  } finally {
    await ctx.stop();
  }
});

integrationTest("GET /api/mongo/trees/nearby returns trees within radius of Cologne Cathedral", async () => {
  const ctx = await setup();
  try {
    // Oak tree (S00002) is at Domkloster, right next to the cathedral
    const res = await fetch(
      `${ctx.baseUrl}/api/mongo/trees/nearby?lat=50.9413&lon=6.9578&radius=100`,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    // At least the Domkloster oak should be within 100m
    if (body.data.length < 1) {
      throw new Error("Expected at least 1 tree near the cathedral");
    }
    // Distances must be sorted ascending (that's what $geoNear guarantees)
    for (let i = 1; i < body.data.length; i++) {
      if (body.data[i].distance_m < body.data[i - 1].distance_m) {
        throw new Error("Results not sorted by distance");
      }
    }
  } finally {
    await ctx.stop();
  }
});

integrationTest("GET /api/mongo/trees/nearby without lat/lon returns 400", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/mongo/trees/nearby`);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.code, "VALIDATION_ERROR");
  } finally {
    await ctx.stop();
  }
});

integrationTest("POST /api/mongo/trees without API key returns 401", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/mongo/trees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "Feature",
        geometry: { type: "Point", coordinates: [6.95, 50.94] },
        properties: { botanischer_name: "Test" },
      }),
    });
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.code, "UNAUTHORIZED");
  } finally {
    await ctx.stop();
  }
});
