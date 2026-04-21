import { MongoClient } from "mongo";
import { env } from "./lib/env.ts";

const client = new MongoClient();
// La conexión se inicializa al arrancar el servidor
await client.connect(env.MONGO_URI);

export const dbMongo = client.database("cologne_datahub");
export const arbolesMongo = dbMongo.collection("arboles");
