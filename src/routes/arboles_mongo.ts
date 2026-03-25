import { Hono } from "hono";
import { ObjectId } from "mongo";
import { arbolesMongo } from "../mongo_db.ts"; // Mantenemos el nombre de la importación para no romper tu archivo db
import { apiKeyAuth } from "../middleware/auth.ts";

export const mongoRouter = new Hono();

// 39. GET /api/mongo/trees - All trees with pagination
mongoRouter.get("/trees", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  const skip = (page - 1) * limit;

  const trees = await arbolesMongo.find({}).skip(skip).limit(limit).toArray();
  return c.json({ data: trees, page, limit });
});

// 40. GET /api/mongo/trees/:id - Tree by MongoDB _id
mongoRouter.get("/trees/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const tree = await arbolesMongo.findOne({ _id: new ObjectId(id) });
    if (!tree) return c.json({ error: "Tree not found" }, 404);
    return c.json({ data: tree }); // Añadido { data: ... } para mantener la consistencia con las otras rutas
  } catch {
    return c.json({ error: "Invalid ID format" }, 400);
  }
});

// 41. GET /api/mongo/statistics/neighborhoods - Aggregation: count by neighborhood
mongoRouter.get("/statistics/neighborhoods", async (c) => {
  const stats = await arbolesMongo
    .aggregate([
      { $group: { _id: "$properties.stadtteil", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  return c.json({ data: stats });
});

// 43. GET /api/mongo/trees/nearby - Geo query ($near)
mongoRouter.get("/trees/nearby", async (c) => {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  const radius = Number(c.req.query("radius") ?? 500); // Cambiado a 'radius' en inglés

  if (isNaN(lat) || isNaN(lon)) {
    return c.json(
      { error: "The lat and lon parameters are required and must be numbers" },
      400,
    );
  }

  const nearby = await arbolesMongo
    .find({
      geometry: {
        $near: {
          $geometry: { type: "Point", coordinates: [lon, lat] }, // GeoJSON standard requires [Longitude, Latitude]
          $maxDistance: radius,
        },
      },
    })
    .toArray();

  return c.json({ data: nearby, radius_meters: radius, total: nearby.length });
});

// 42. POST /api/mongo/trees - Create new tree (Protected with API Key)
mongoRouter.post("/trees", apiKeyAuth, async (c) => {
  try {
    const body = await c.req.json();

    // Basic validation for GeoJSON Feature structure
    if (body.type !== "Feature" || !body.geometry || !body.properties) {
      return c.json(
        { error: "The body must be a valid GeoJSON Feature object" },
        422,
      );
    }

    const insertId = await arbolesMongo.insertOne(body);
    return c.json({ message: "Record created", id: insertId }, 201);
  } catch {
    return c.json({ error: "Invalid JSON or internal error" }, 400);
  }
});
