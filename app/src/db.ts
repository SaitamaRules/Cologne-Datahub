import { Pool } from "postgres";
import { env } from "./lib/env.ts";

export const pool = new Pool(
  {
    hostname: env.DB_HOST,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  },
  10,
);
