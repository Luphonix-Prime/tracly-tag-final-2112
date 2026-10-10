import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import * as schema from "./schema/index";
import path from "path";
import * as dotenv from "dotenv";

let resolvedDirname = "";
try {
  resolvedDirname = import.meta.dirname || __dirname;
} catch (e) {
  resolvedDirname = ".";
}

// Load env files from workspace root or package directories
dotenv.config({ path: path.resolve(resolvedDirname, "../../../.env") });
dotenv.config({ path: path.resolve(resolvedDirname, "../../.env") });
dotenv.config({ path: path.resolve(resolvedDirname, "../.env") });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "tracelytag"}:${process.env.POSTGRES_PASSWORD || "tracelytag_secret_2026"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "tracelytag"}`;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
