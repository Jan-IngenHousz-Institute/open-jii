import { createOpenAPI } from "fumadocs-openapi/server";
import { resolve } from "node:path";

// openapi.json is synced from packages/api during the docs build (see scripts/sync-specs.mjs).
export const openapi = createOpenAPI({
  input: [resolve(process.cwd(), "openapi.json")],
});
