import { MongoClient } from "mongo";

console.log("Leyendo archivo GeoJSON...");
const raw = await Deno.readTextFile("data/baumkataster.json");
const geojson = JSON.parse(raw);

console.log("Conectando a MongoDB...");
const client = new MongoClient();
await client.connect("mongodb://localhost:27017");

const collection = client.database("cologne_datahub").collection("arboles");

await collection.deleteMany({});

console.log("Importando datos...");
await collection.insertMany(geojson.features);

console.log(`${geojson.features.length} documentos importados con éxito en MongoDB.`);

client.close();
