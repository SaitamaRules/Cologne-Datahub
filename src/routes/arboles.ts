// src/routes/arboles.ts
import { Hono } from "hono";
import { pool } from "../db.ts";

export const apiRouter = new Hono();

// Interfaz TypeScript requerida en el punto 2.5
export interface Tree {
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
                 WHERE n.name = $1 LIMIT $2 OFFSET $3`,
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
    const body = await c.req.json<Tree>();
    
    if (!body.tree_number) {
        return c.json({ error: 'El campo tree_number es obligatorio' }, 422);
    }

    const client = await pool.connect();
    try {
        const result = await client.queryObject(
            `INSERT INTO trees (tree_number, botanical_name, street) 
             VALUES ($1, $2, $3) RETURNING id`,
            [body.tree_number, body.botanical_name, body.street]
        );
        return c.json({ message: 'Árbol creado', id: result.rows[0] }, 201);
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Error al crear el registro' }, 500);
    } finally {
        client.release();
    }
});

// 5. PUT /arboles/:id - Actualizar registro
apiRouter.put('/arboles/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json<Tree>();
    
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const client = await pool.connect();
    try {
        const check = await client.queryObject`SELECT id FROM trees WHERE id = ${id}`;
        if (check.rows.length === 0) return c.json({ error: 'Árbol no encontrado' }, 404);

        await client.queryObject(
            `UPDATE trees SET botanical_name = $1, street = $2 WHERE id = $3`,
            [body.botanical_name, body.street, id]
        );
        return c.json({ message: 'Árbol actualizado' });
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
        const result = await client.queryObject(
            `SELECT n.name as barrio, COUNT(t.id) as cantidad_arboles 
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
            `SELECT botanical_name as especie, COUNT(*) as cantidad 
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
