// src/routes/arboles.ts
import { Hono } from "hono";
import { pool } from "../db.ts";

export const apiRouter = new Hono();

// Interfaz TypeScript
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
export type collectNewTree = Omit<Tree, 'id'>

// 1 y 3. GET /arboles - Todos los árboles (paginación) y Filtro por barrio
apiRouter.get('/arboles', async (c) => {
    const page = Number(c.req.query('page') ?? 1);
    const limit = Number(c.req.query('limit') ?? 20);
    const barrio = c.req.query('barrio');

    if (isNaN(page) || isNaN(limit)) {
        return c.json({ error: 'Parámetros de paginación inválidos' }, 400);
    }

    const offset = (page - 1) * limit;
    const client = await pool.connect();

    try {
        let result;
        if (barrio) {
            result = await client.queryObject(
                `SELECT t.* FROM trees t 
                 JOIN neighborhoods n ON t.neighborhood_id = n.id 
                 WHERE n.name ILIKE $1 LIMIT $2 OFFSET $3`,
                [barrio, limit, offset]
            );
        } else {
            result = await client.queryObject(
                `SELECT * FROM trees LIMIT $1 OFFSET $2`,
                [limit, offset]
            );
        }
        return c.json({ data: result.rows, page, limit });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error interno de base de datos' }, 500);
    } finally {
        client.release();
    }
});

// 2. GET /arboles/:id - Obtener por ID
apiRouter.get('/arboles/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const client = await pool.connect();
    try {
        const result = await client.queryObject`SELECT * FROM trees WHERE id = ${id}`;
        if (result.rows.length === 0) return c.json({ error: 'Árbol no encontrado' }, 404);
        return c.json({ data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error interno de base de datos' }, 500);
    } finally {
        client.release();
    }
});

// 4. POST /arboles - Crear registro
apiRouter.post('/arboles', async (c) => {
    const body = await c.req.json<collectNewTree>();

    if (!body.tree_number) {
        return c.json({ error: 'El campo tree_number es obligatorio' }, 422);
    }

    const client = await pool.connect();
    try {
        const fields = [];
        const indices = [];
        const values = [];
        let i = 1;
        
        for(const key in body) {
            if(key !== "id") {
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
            values
        );
        return c.json({ message: 'Árbol creado', data: result.rows[0] }, 201);
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error al crear el registro' }, 500);
    } finally {
        client.release();
    }
});

// 5. PUT /arboles/:id - Actualizar registro dinámicamente
apiRouter.put('/arboles/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json<Tree>();

    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    if (Object.keys(body).length === 0) return c.json({ error: 'El cuerpo de la petición está vacío' }, 400);

    const client = await pool.connect();
    try {
        const check = await client.queryObject`SELECT id FROM trees WHERE id = ${id}`;
        if (check.rows.length === 0) return c.json({ error: 'Árbol no encontrado' }, 404);

        const setFields = [];
        const values = [];
        let i = 1;
        
        for (const key in body) {
            if (key !== "id") {
                setFields.push(`${key} = $${i++}`);
                values.push(body[key as keyof typeof body]);
            }
        }
        values.push(id); // Añadimos el ID como último parámetro para el WHERE
        const setString = setFields.join(", ");

        const result = await client.queryObject(
            `UPDATE trees SET ${setString} WHERE id = $${i} RETURNING *`,
            values
        );
        
        return c.json({ message: 'Árbol actualizado', data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error interno de base de datos' }, 500);
    } finally {
        client.release();
    }
});

// 6. DELETE /arboles/:id - Eliminar registro
apiRouter.delete('/arboles/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const client = await pool.connect();
    try {
        const result = await client.queryObject`DELETE FROM trees WHERE id = ${id} RETURNING id`;
        if (result.rows.length === 0) return c.json({ error: 'Árbol no encontrado' }, 404);
        return c.json({ message: 'Árbol eliminado' });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error interno de base de datos' }, 500);
    } finally {
        client.release();
    }
});

// 7. GET /estadisticas/barrios - Número de árboles por barrio
apiRouter.get('/estadisticas/barrios', async (c) => {
    const client = await pool.connect();
    try {
        // Se añade ::int para evitar el error de serialización de BigInt
        const result = await client.queryObject(
            `SELECT n.name as barrio, COUNT(t.id)::int as cantidad_arboles 
             FROM trees t JOIN neighborhoods n ON t.neighborhood_id = n.id 
             GROUP BY n.name ORDER BY cantidad_arboles DESC`
        );
        return c.json({ data: result.rows });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error interno de base de datos' }, 500);
    } finally {
        client.release();
    }
});

// 8. GET /estadisticas/especies - Top 10 especies
apiRouter.get('/estadisticas/especies', async (c) => {
    const client = await pool.connect();
    try {
        const result = await client.queryObject(
            `SELECT botanical_name as especie, COUNT(*)::int as cantidad 
             FROM trees GROUP BY botanical_name 
             ORDER BY cantidad DESC LIMIT 10`
        );
        return c.json({ data: result.rows });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error interno de base de datos' }, 500);
    } finally {
        client.release();
    }
});
