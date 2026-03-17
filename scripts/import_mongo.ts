import { MongoClient } from "mongo";
import proj4 from "proj4";

proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

console.log("Leyendo archivo GeoJSON (completo)...");
const raw = await Deno.readTextFile("data/baumkataster_full.json");
const geojson = JSON.parse(raw);

console.log("Convirtiendo coordenadas cartográficas a GPS (WGS84)...");
const features = geojson.features;
for (const feature of features) {
    if (feature.geometry && feature.geometry.coordinates) {
        const [x, y] = feature.geometry.coordinates;
        // Transformar de EPSG:25832 (metros) a EPSG:4326 (grados WGS84)
        feature.geometry.coordinates = proj4("EPSG:25832", "EPSG:4326", [x, y]);
    }
}

console.log("Conectando a MongoDB...");
const client = new MongoClient();
await client.connect("mongodb://localhost:27017");

const collection = client.database("cologne_datahub").collection("arboles");

console.log("Limpiando colección antigua...");
await collection.deleteMany({});

console.log("Importando datos convertidos por lotes...");
const BATCH_SIZE = 500;
let insertados = 0;

for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE);
    await collection.insertMany(batch);
    insertados += batch.length;
    console.log(`Progreso: ${insertados} / ${features.length} documentos...`);
}

console.log("Importación completada con éxito. Las coordenadas ya son compatibles con MongoDB.");
client.close();
