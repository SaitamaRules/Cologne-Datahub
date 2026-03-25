import { MongoClient } from "mongo";
import proj4 from "proj4";

proj4.defs(
  "EPSG:25832",
  "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
);

console.log("Reading full GeoJSON file...");
const raw = await Deno.readTextFile("data/baumkataster_full.json");
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

console.log("Connecting to MongoDB...");
const client = new MongoClient();
await client.connect("mongodb://localhost:27017");

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

console.log(
  "Import completed successfully. Coordinates are now compatible with MongoDB.",
);
client.close();
