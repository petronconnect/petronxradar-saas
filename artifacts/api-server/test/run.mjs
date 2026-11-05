import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readdir, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(artifactDir, "test");
const outputDir = path.join(artifactDir, "node_modules", ".cache", "api-tests");
const entries = (await readdir(testDir))
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => path.join(testDir, file));

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await build({
  absWorkingDir: artifactDir,
  entryPoints: entries,
  outdir: outputDir,
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: "inline",
  logLevel: "info",
  external: [
    "*.node",
    "better-sqlite3",
    "bcrypt",
    "fsevents",
    "pg-native",
    "sharp",
    "sqlite3",
  ],
  banner: {
    js: `import { createRequire as __testCreateRequire } from "node:module";
globalThis.require = __testCreateRequire(import.meta.url);`,
  },
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
});

const testFiles = entries.map((entry) => path.join(outputDir, `${path.basename(entry, ".ts")}.js`));
const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: "postgres://test:test@127.0.0.1:1/api_test_only",
    NODE_ENV: "test",
  },
});

await rm(outputDir, { recursive: true, force: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
