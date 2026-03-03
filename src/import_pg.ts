// src/import_pg.ts
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const raw = await Deno.readTextFile("baumkataster_full.json");
const geojson = JSON.parse(raw);

const client = new Client({ 
    hostname: "localhost", 
    database: "cologne_datahub", 
    user: "postgres", 
    password: "Usuario1+"
});

await client.connect();
console.log("Connected to PostgreSQL. Initializing import...");

const parseNum = (val: string) => (val === "" || val === undefined || val === null) ? null : Number(val);

for (const feature of geojson.features) {
    const p = feature.properties;
    const [lon, lat] = feature.geometry.coordinates;

    const treeNumber = p.Baumnummer || feature.id?.toString(); 

    let neighborhoodId = null;
    if (p.Stadtteil) {
        const res = await client.queryObject<{id: number}>(`
            INSERT INTO neighborhoods (name) 
            VALUES ($1) 
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name 
            RETURNING id
        `, [p.Stadtteil]);
        neighborhoodId = res.rows[0].id;
    }

    await client.queryObject(`
        INSERT INTO trees (
            tree_number, botanical_name, planting_year, 
            trunk_circumference_cm, height_m, street, 
            neighborhood_id, lat, lon, natural_monument
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        ON CONFLICT (tree_number) DO NOTHING
    `, [
        treeNumber, 
        p.Botanischer_Name?.trim(), 
        parseNum(p.Pflanzjahr), 
        parseNum(p['Stammumfang_-_cm']),
        parseNum(p['Höhe_-_m']), 
        p.Straße, 
        neighborhoodId,
        lat, 
        lon, 
        p.Naturdenkmal === 'ja'
    ]);
}

console.log("Finished.");
await client.end();
