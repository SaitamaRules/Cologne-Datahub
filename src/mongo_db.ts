import { MongoClient } from "mongo";

const client = new MongoClient();
// La conexión se inicializa al arrancar el servidor
await client.connect(Deno.env.get('MONGO_URI') ?? "mongodb://localhost:27017");

export const dbMongo = client.database("cologne_datahub");
export const arbolesMongo = dbMongo.collection("arboles");
