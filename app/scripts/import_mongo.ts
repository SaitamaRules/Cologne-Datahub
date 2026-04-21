import { MongoClient } from "mongo";
import proj4 from "proj4";
import { env } from "../src/lib/env.ts";

const DATA_PATH = Deno.env.get("DATA_PATH") ?? "data/baumkataster.json";

proj4.defs(
  "EPSG:25832",
  "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
);

console.log(`Reading GeoJSON from ${DATA_PATH}...`);
const raw = await Deno.readTextFile(DATA_PATH);
const geojson = JSON.parse(raw);

console.log("Converting cartographic coordinates to GPS (WGS84)...");
const features = geojson.features;
for (const feature of features) {
  if (feature.geometry && feature.geometry.coordinates) {
    const [x, y] = feature.geometry.coordinates;
    // Transform from EPSG:25832 (meters) to EPSG:4326 (WGS84 degrees)
    feature.geometry.coordinates = proj4("EPSG:25832", "EPSG:4326", [x, y]);
  }
}

console.log(`Connecting to MongoDB at ${env.MONGO_URI}...`);
const client = new MongoClient();
await client.connect(env.MONGO_URI);

const collection = client.database("cologne_datahub").collection("arboles");

console.log("Clearing old collection...");
await collection.deleteMany({});

console.log("Importing converted data in batches...");
const BATCH_SIZE = 500;
let inserted = 0;

for (let i = 0; i < features.length; i += BATCH_SIZE) {
  const batch = features.slice(i, i + BATCH_SIZE);
  await collection.insertMany(batch);
  inserted += batch.length;
  console.log(`Progress: ${inserted} / ${features.length} documents...`);
}

console.log("Creating 2dsphere index on geometry field...");
await collection.createIndexes({
  indexes: [{ key: { geometry: "2dsphere" }, name: "geometry_2dsphere" }],
});

console.log("Import completed successfully.");
client.close();
