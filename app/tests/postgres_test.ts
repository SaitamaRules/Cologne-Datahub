import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { integrationTest, setup } from "./helpers.ts";

integrationTest("GET /api/trees returns seeded trees with pagination", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/trees?page=1&limit=10`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.data.length, 3);
    assertEquals(body.page, 1);
    assertEquals(body.limit, 10);
  } finally {
    await ctx.stop();
  }
});

integrationTest("GET /api/trees?neighborhood filters correctly", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/trees?neighborhood=Altstadt-Nord`);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.data.length, 1);
    assertEquals(body.data[0].tree_number, "S00002");
  } finally {
    await ctx.stop();
  }
});

integrationTest("GET /api/trees/:id returns 404 for missing tree", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/trees/999999`);
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error.code, "TREE_NOT_FOUND");
  } finally {
    await ctx.stop();
  }
});

integrationTest("POST /api/trees without API key returns 401 with UNAUTHORIZED code", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/trees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tree_number: "S99999" }),
    });
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.code, "UNAUTHORIZED");
  } finally {
    await ctx.stop();
  }
});

integrationTest("POST /api/trees with valid API key creates a tree", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/trees`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ctx.apiKey,
      },
      body: JSON.stringify({
        tree_number: "S99999",
        botanical_name: "Fagus sylvatica",
        planting_year: 2024,
      }),
    });
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.data.tree_number, "S99999");
    assertEquals(body.data.botanical_name, "Fagus sylvatica");
  } finally {
    await ctx.stop();
  }
});

integrationTest("POST /api/trees without tree_number returns 422", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/trees`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ctx.apiKey,
      },
      body: JSON.stringify({ botanical_name: "Pinus sylvestris" }),
    });
    assertEquals(res.status, 422);
    const body = await res.json();
    assertEquals(body.error.code, "VALIDATION_ERROR");
  } finally {
    await ctx.stop();
  }
});

integrationTest("GET /api/statistics/species returns ranked species", async () => {
  const ctx = await setup();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/statistics/species`);
    assertEquals(res.status, 200);
    const body = await res.json();
    // Three distinct species seeded, each with count 1
    assertEquals(body.data.length, 3);
    for (const row of body.data) {
      assertEquals(row.count, 1);
    }
  } finally {
    await ctx.stop();
  }
});
