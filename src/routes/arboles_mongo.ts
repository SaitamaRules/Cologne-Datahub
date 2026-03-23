import { Hono } from "hono";
import { ObjectId } from "mongo";
import { arbolesMongo } from "../mongo_db.ts";
import { apiKeyAuth } from "../middleware/auth.ts";

export const mongoRouter = new Hono();

// 39. GET /api/mongo/arboles - Todos los árboles con paginación
mongoRouter.get('/arboles', async (c) => {
    const page = Number(c.req.query('page') ?? 1);
    const limit = Number(c.req.query('limit') ?? 20);
    const skip = (page - 1) * limit;

    const arboles = await arbolesMongo.find({}).skip(skip).limit(limit).toArray();
    return c.json({ data: arboles, page, limit });
});

// 40. GET /api/mongo/arboles/:id - Árbol por _id de MongoDB
mongoRouter.get('/arboles/:id', async (c) => {
    const id = c.req.param('id');
    try {
        const arbol = await arbolesMongo.findOne({ _id: new ObjectId(id) });
        if (!arbol) return c.json({ error: 'Árbol no encontrado' }, 404);
        return c.json(arbol);
    } catch {
        return c.json({ error: 'Formato de ID inválido' }, 400);
    }
});

// 41. GET /api/mongo/estadisticas/barrios - Agregación: conteo por barrio
mongoRouter.get('/estadisticas/barrios', async (c) => {
    const stats = await arbolesMongo.aggregate([
        { $group: { _id: "$properties.stadtteil", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();
    
    return c.json({ data: stats });
});

// 43. GET /api/mongo/arboles/cercanos - Consulta geo ($near)
mongoRouter.get('/arboles/cercanos', async (c) => {
    const lat = Number(c.req.query('lat'));
    const lon = Number(c.req.query('lon'));
    const radio = Number(c.req.query('radio') ?? 500);

    if (isNaN(lat) || isNaN(lon)) {
        return c.json({ error: 'Parámetros lat y lon son obligatorios y numéricos' }, 400);
    }

    const cercanos = await arbolesMongo.find({
        geometry: {
            $near: {
                $geometry: { type: "Point", coordinates: [lon, lat] }, // El estándar GeoJSON exige [Longitud, Latitud]
                $maxDistance: radio
            }
        }
    }).toArray();

    return c.json({ data: cercanos, radio_metros: radio, total: cercanos.length });
});

// 42. POST /api/mongo/arboles - Crear nuevo árbol (Protegido con API Key)
mongoRouter.post('/arboles', apiKeyAuth, async (c) => {
    try {
        const body = await c.req.json();
        
        // Validación básica de la estructura GeoJSON
        if (body.type !== "Feature" || !body.geometry || !body.properties) {
            return c.json({ error: 'El cuerpo debe ser un objeto GeoJSON Feature válido' }, 422);
        }

        const insertId = await arbolesMongo.insertOne(body);
        return c.json({ message: 'Registro creado', id: insertId }, 201);
    } catch {
        return c.json({ error: 'JSON inválido o error interno' }, 400);
    }
});
