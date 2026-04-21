import { Hono } from "hono";
import { ObjectId } from "mongo";
import { arbolesMongo } from "../mongo_db.ts";
import { apiKeyAuth } from "../middleware/auth.ts";
import { jsonError } from "../lib/errors.ts";

export const mongoRouter = new Hono();

// 39. GET /api/mongo/trees - All trees with pagination
mongoRouter.get("/trees", async (c) => {
  try {
    const page = Number(c.req.query("page") ?? 1);
    const limit = Number(c.req.query("limit") ?? 20);
    const skip = (page - 1) * limit;

    const trees = await arbolesMongo.find({}).skip(skip).limit(limit).toArray();
    return c.json({ data: trees, page, limit });
  } catch {
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  }
});

// 43. GET /api/mongo/trees/nearby - Geo query ($geoNear)
mongoRouter.get("/trees/nearby", async (c) => {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  const radius = Number(c.req.query("radius") ?? 500);
  const limit = Number(c.req.query("limit") ?? 50);

  if (isNaN(lat) || isNaN(lon)) {
    return jsonError(
      c,
      400,
      "VALIDATION_ERROR",
      "The lat and lon parameters are required and must be numbers",
    );
  }

  try {
    const nearby = await arbolesMongo
      .aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lon, lat] },
            distanceField: "distance_m",
            maxDistance: radius,
            spherical: true,
          },
        },
        { $limit: limit },
      ])
      .toArray();

    return c.json({
      data: nearby,
      radius_meters: radius,
      total: nearby.length,
    });
  } catch {
    return jsonError(
      c,
      500,
      "GEO_QUERY_FAILED",
      "Geo query failed. Is the 2dsphere index created?",
    );
  }
});

// 40. GET /api/mongo/trees/:id - Tree by MongoDB _id
mongoRouter.get("/trees/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const tree = await arbolesMongo.findOne({ _id: new ObjectId(id) });
    if (!tree) return jsonError(c, 404, "TREE_NOT_FOUND", "Tree not found");
    return c.json({ data: tree });
  } catch {
    return jsonError(c, 400, "INVALID_ID", "Invalid ID format");
  }
});

// 41. GET /api/mongo/statistics/neighborhoods - Aggregation: count by neighborhood
mongoRouter.get("/statistics/neighborhoods", async (c) => {
  try {
    const stats = await arbolesMongo
      .aggregate([
        { $group: { _id: "$properties.stadtteil", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    return c.json({ data: stats });
  } catch {
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  }
});

// 42. POST /api/mongo/trees - Create new tree (Protected with API Key)
mongoRouter.post("/trees", apiKeyAuth, async (c) => {
  try {
    const body = await c.req.json();

    if (body.type !== "Feature" || !body.geometry || !body.properties) {
      return jsonError(
        c,
        422,
        "INVALID_FEATURE",
        "The body must be a valid GeoJSON Feature object",
      );
    }

    const insertId = await arbolesMongo.insertOne(body);
    return c.json({ message: "Record created", id: insertId }, 201);
  } catch {
    return jsonError(c, 400, "INVALID_JSON", "Invalid JSON or internal error");
  }
});
