import { Hono } from "hono";
import { pool } from "../db.ts";
import { apiKeyAuth } from "../middleware/auth.ts";
import { jsonError } from "../lib/errors.ts";

export const apiRouter = new Hono();

// TypeScript Interface
export interface Tree {
  id: number;
  tree_number: string;
  botanical_name?: string;
  planting_year?: number;
  trunk_circumference_cm?: number;
  height_m?: number;
  street?: string;
  neighborhood_id?: number;
  natural_monument?: boolean;
  lat?: number;
  lon?: number;
}
export type collectNewTree = Omit<Tree, "id">;

// 1 & 3. GET /trees - All trees (pagination) & Filter by neighborhood
apiRouter.get("/trees", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  const neighborhood = c.req.query("neighborhood");

  if (isNaN(page) || isNaN(limit)) {
    return jsonError(c, 400, "INVALID_PAGINATION", "Invalid pagination parameters");
  }

  const offset = (page - 1) * limit;
  const client = await pool.connect();

  try {
    let result;
    if (neighborhood) {
      result = await client.queryObject(
        `SELECT t.* FROM trees t 
                 JOIN neighborhoods n ON t.neighborhood_id = n.id 
                 WHERE n.name ILIKE $1 LIMIT $2 OFFSET $3`,
        [neighborhood, limit, offset],
      );
    } else {
      result = await client.queryObject(
        `SELECT * FROM trees LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
    }
    return c.json({ data: result.rows, page, limit });
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  } finally {
    client.release();
  }
});

// 2. GET /trees/:id - Get by ID
apiRouter.get("/trees/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "INVALID_ID", "Invalid ID");

  const client = await pool.connect();
  try {
    const result = await client.queryObject`SELECT * FROM trees WHERE id = ${id}`;
    if (result.rows.length === 0) {
      return jsonError(c, 404, "TREE_NOT_FOUND", "Tree not found");
    }
    return c.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  } finally {
    client.release();
  }
});

// 4. POST /trees - Create record
apiRouter.post("/trees", apiKeyAuth, async (c) => {
  const body = await c.req.json<collectNewTree>();

  if (!body.tree_number) {
    return jsonError(c, 422, "VALIDATION_ERROR", "The tree_number field is required");
  }

  const client = await pool.connect();
  try {
    const fields = [];
    const indices = [];
    const values = [];
    let i = 1;

    for (const key in body) {
      if (key !== "id") {
        fields.push(key as keyof typeof body);
        values.push(body[key as keyof typeof body]);
        indices.push("$" + i++);
      }
    }
    const fieldString = fields.join(", ");
    const indicesString = indices.join(", ");

    const result = await client.queryObject(
      `INSERT INTO trees (${fieldString}) 
             VALUES (${indicesString}) RETURNING *`,
      values,
    );
    return c.json({ message: "Tree created", data: result.rows[0] }, 201);
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Error creating record");
  } finally {
    client.release();
  }
});

// 5. PUT /trees/:id - Update record dynamically
apiRouter.put("/trees/:id", apiKeyAuth, async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<Tree>();

  if (isNaN(id)) return jsonError(c, 400, "INVALID_ID", "Invalid ID");
  if (Object.keys(body).length === 0) {
    return jsonError(c, 400, "EMPTY_BODY", "Request body is empty");
  }

  const client = await pool.connect();
  try {
    const check = await client.queryObject`SELECT id FROM trees WHERE id = ${id}`;
    if (check.rows.length === 0) {
      return jsonError(c, 404, "TREE_NOT_FOUND", "Tree not found");
    }

    const setFields = [];
    const values = [];
    let i = 1;

    for (const key in body) {
      if (key !== "id") {
        setFields.push(`${key} = $${i++}`);
        values.push(body[key as keyof typeof body]);
      }
    }
    values.push(id);
    const setString = setFields.join(", ");

    const result = await client.queryObject(
      `UPDATE trees SET ${setString} WHERE id = $${i} RETURNING *`,
      values,
    );

    return c.json({ message: "Tree updated", data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  } finally {
    client.release();
  }
});

// 6. DELETE /trees/:id - Delete record
apiRouter.delete("/trees/:id", apiKeyAuth, async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "INVALID_ID", "Invalid ID");

  const client = await pool.connect();
  try {
    const result = await client.queryObject`DELETE FROM trees WHERE id = ${id} RETURNING id`;
    if (result.rows.length === 0) {
      return jsonError(c, 404, "TREE_NOT_FOUND", "Tree not found");
    }
    return c.json({ message: "Tree deleted" });
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  } finally {
    client.release();
  }
});

// 7. GET /statistics/neighborhoods - Number of trees per neighborhood
apiRouter.get("/statistics/neighborhoods", async (c) => {
  const client = await pool.connect();
  try {
    const result = await client.queryObject(
      `SELECT n.name as neighborhood, COUNT(t.id)::int as tree_count 
             FROM trees t JOIN neighborhoods n ON t.neighborhood_id = n.id 
             GROUP BY n.name ORDER BY tree_count DESC`,
    );
    return c.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  } finally {
    client.release();
  }
});

// 8. GET /statistics/species - Top 10 species
apiRouter.get("/statistics/species", async (c) => {
  const client = await pool.connect();
  try {
    const result = await client.queryObject(
      `SELECT botanical_name as species, COUNT(*)::int as count 
             FROM trees GROUP BY botanical_name 
             ORDER BY count DESC LIMIT 10`,
    );
    return c.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    return jsonError(c, 500, "DATABASE_ERROR", "Internal database error");
  } finally {
    client.release();
  }
});
