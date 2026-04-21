import { Pool } from "postgres";
import { load } from "@std/dotenv";
await load({ export: true });
export const pool = new Pool(
  {
    hostname: Deno.env.get("DB_HOST") ?? "localhost",
    database: Deno.env.get("DB_NAME") ?? "cologne_datahub",
    user: Deno.env.get("DB_USER") ?? "postgres",
    password: Deno.env.get("DB_PASSWORD"),
    port: Number(Deno.env.get("DB_PORT") ?? 5432),
  },
  10,
);
