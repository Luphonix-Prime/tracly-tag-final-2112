import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import * as dotenv from "dotenv";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from the workspace root or local directory
dotenv.config({ path: path.resolve(artifactDir, "../../.env") });
dotenv.config({ path: path.resolve(artifactDir, ".env") });
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;
const sessionSecret = process.env.SESSION_SECRET;

console.log("Build environment config status:");
console.log("- DATABASE_URL:", dbUrl ? "Found (" + dbUrl.slice(0, 30) + "...)" : "Missing");
console.log("- DATABASE_AUTH_TOKEN:", dbAuthToken ? "Found (masked)" : "Missing");
console.log("- SESSION_SECRET:", sessionSecret ? "Found (masked)" : "Missing");

const defineEnv = {
  // Let runtime environment variables take precedence in Docker / production
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  const apiDir = path.resolve(artifactDir, "api");
  await rm(apiDir, { recursive: true, force: true });

  const externalList = [
    "*.node",
    "libsql",
    "@libsql/*",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "xxhash-addon",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "isolated-vm",
    "lightningcss",
    "pg-native",
    "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "handlebars",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@prisma/client",
    "@mikro-orm/*",
    "@grpc/*",
    "@swc/*",
    "@aws-sdk/*",
    "@azure/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "@google/*",
    "googleapis",
    "firebase-admin",
    "@parcel/watcher",
    "@sentry/profiling-node",
    "@tree-sitter/*",
    "aws-sdk",
    "classic-level",
    "dd-trace",
    "ffi-napi",
    "grpc",
    "hiredis",
    "kerberos",
    "leveldown",
    "miniflare",
    "mysql2",
    "newrelic",
    "odbc",
    "piscina",
    "realm",
    "ref-napi",
    "rocksdb",
    "sass-embedded",
    "sequelize",
    "serialport",
    "snappy",
    "tinypool",
    "usb",
    "workerd",
    "wrangler",
    "zeromq",
    "zeromq-prebuilt",
    "playwright",
    "puppeteer",
    "puppeteer-core",
    "electron",
  ];

  const pinoPlugin = esbuildPluginPino({ transports: ["pino-pretty"] });

  const bannerConfig = {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
  };

  // 1. Build local server (dist/index.mjs)
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: externalList,
    sourcemap: "linked",
    plugins: [pinoPlugin],
    banner: bannerConfig,
    define: defineEnv,
  });

  // 2. Build Vercel serverless function (api/index.js)
  await esbuild({
    entryPoints: {
      index: path.resolve(artifactDir, "src/app.ts")
    },
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: apiDir,
    outExtension: { ".js": ".js" },
    logLevel: "info",
    external: externalList,
    sourcemap: "linked",
    plugins: [pinoPlugin],
    banner: bannerConfig,
    define: defineEnv,
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
