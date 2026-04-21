import { Client } from "postgres";
import { env } from "../src/lib/env.ts";

const DATA_PATH = Deno.env.get("DATA_PATH") ?? "data/baumkataster.json";

const raw = await Deno.readTextFile(DATA_PATH);
const geojson = JSON.parse(raw);

const client = new Client({
  hostname: env.DB_HOST,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
});

await client.connect();
console.log(
  `Connected to PostgreSQL at ${env.DB_HOST}:${env.DB_PORT}. Importing ${geojson.features.length} features...`,
);

const parseNum = (val: string) =>
  val === "" || val === undefined || val === null ? null : Number(val);

for (const feature of geojson.features) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;

  const treeNumber = p.Baumnummer || feature.id?.toString();

  let neighborhoodId = null;
  if (p.Stadtteil) {
    const res = await client.queryObject<{ id: number }>(
      `
            INSERT INTO neighborhoods (name) 
            VALUES ($1) 
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name 
            RETURNING id
        `,
      [p.Stadtteil],
    );
    neighborhoodId = res.rows[0].id;
  }

  await client.queryObject(
    `
        INSERT INTO trees (
            tree_number, botanical_name, planting_year, 
            trunk_circumference_cm, height_m, street, 
            neighborhood_id, lat, lon, natural_monument
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        ON CONFLICT (tree_number) DO NOTHING
    `,
    [
      treeNumber,
      p.Botanischer_Name?.trim(),
      parseNum(p.Pflanzjahr),
      parseNum(p["Stammumfang_-_cm"]),
      parseNum(p["Höhe_-_m"]),
      p.Straße,
      neighborhoodId,
      lat,
      lon,
      p.Naturdenkmal === "ja",
    ],
  );
}

console.log("Finished.");
await client.end();
