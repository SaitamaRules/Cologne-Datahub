import { load } from "@std/dotenv";

// Load .env if present. In containers, env vars are already injected,
// so load() acts as a no-op safety net for local development.
await load({ export: true });

function required(key: string): string {
  const value = Deno.env.get(key);
  if (!value || value.trim() === "") {
    throw new Error(
      `[config] Missing required environment variable: ${key}. ` +
        `Set it in your .env file or your container's environment.`,
    );
  }
  return value;
}

function optional(key: string, fallback: string): string {
  const value = Deno.env.get(key);
  return value && value.trim() !== "" ? value : fallback;
}

/**
 * Validated, typed environment configuration.
 * Importing this module triggers validation; the process will exit
 * with a clear error if any required variable is missing.
 */
export const env = {
  // PostgreSQL
  DB_HOST: optional("DB_HOST", "localhost"),
  DB_NAME: optional("DB_NAME", "cologne_datahub"),
  DB_USER: optional("DB_USER", "postgres"),
  DB_PASSWORD: required("DB_PASSWORD"),
  DB_PORT: Number(optional("DB_PORT", "5432")),

  // MongoDB
  MONGO_URI: optional("MONGO_URI", "mongodb://localhost:27017"),

  // API
  API_KEY: required("API_KEY"),
  PORT: Number(optional("PORT", "8000")),

  // Runtime
  NODE_ENV: optional("NODE_ENV", "development"),
} as const;
