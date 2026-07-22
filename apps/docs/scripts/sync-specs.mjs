import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appDir, "../..");

// REST: OpenAPI generated from packages/api is the single source of truth.
copyFileSync(resolve(repoRoot, "packages/api/dist/openapi.json"), resolve(appDir, "openapi.json"));

// MQTT: root asyncapi.yaml is canonical (the old served copy had diverged).
// Served at /asyncapi.yaml to avoid colliding with the /api/mqtt page route.
const publicDir = resolve(appDir, "public");
mkdirSync(publicDir, { recursive: true });
copyFileSync(resolve(repoRoot, "asyncapi.yaml"), resolve(publicDir, "asyncapi.yaml"));

console.log("Synced openapi.json and asyncapi.yaml into apps/docs.");
