// src/fetch_data.ts
const WFS_URL =
  "https://geoportal.stadt-koeln.de/wss/service/baumkataster_extern_wfs/guest";
const url = `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms:baumkataster&outputFormat=application/json;%20subtype=geojson`;

const response = await fetch(url);
const geojson = await response.json();

await Deno.writeTextFile(
  "data/baumkataster_full.json",
  JSON.stringify(geojson, null, 2),
);
console.log(`Obtenidos: ${geojson.features.length} árboles`);
