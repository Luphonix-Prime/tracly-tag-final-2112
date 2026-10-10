import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

let resolvedDirname = "";
try {
  resolvedDirname = import.meta.dirname || __dirname;
} catch (e) {
  resolvedDirname = ".";
}

dotenv.config({ path: path.resolve(resolvedDirname, "../../.env") });
dotenv.config({ path: path.resolve(resolvedDirname, "../.env") });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "tracelytag"}:${process.env.POSTGRES_PASSWORD || "tracelytag_secret_2026"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "tracelytag"}`;

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
