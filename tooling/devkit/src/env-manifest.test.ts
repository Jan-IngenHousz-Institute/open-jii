import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { envByKey, envManifest } from "./env-manifest.js";
import { renderEnvExample } from "./generate-env.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const sourceRoots = [
  "apps/backend/src",
  "apps/web",
  "packages/analytics/src",
  "packages/api/src",
  "packages/auth/src",
  "packages/cms/src",
  "packages/database/src",
  "packages/i18n/src",
  "packages/iot/src",
  "packages/transactional/src",
  "packages/ui/src",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const sdkOnlyEnv = new Set([
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_PROFILE",
  "AWS_EC2_METADATA_DISABLED",
]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return ["node_modules", "dist", ".next", "test", "tests", "__tests__", "scripts"].includes(
          entry.name,
        )
          ? []
          : sourceFiles(path);
      }
      return sourceExtensions.has(extname(entry.name)) && !/\.(spec|test)\.[^.]+$/.test(entry.name)
        ? [path]
        : [];
    }),
  );
  return nested.flat();
}

function envReads(source: string): Set<string> {
  const keys = new Set<string>();
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const match of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) keys.add(match[1]);
  for (const match of code.matchAll(/process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g))
    keys.add(match[1]);
  for (const match of code.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*process\.env/g)) {
    for (const field of match[1].split(",")) {
      const key = field.trim().split(/\s*:\s*/)[0];
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) keys.add(key);
    }
  }
  return keys;
}

describe("environment manifest", () => {
  it("matches the committed generated examples", async () => {
    await expect(readFile(join(root, "apps/backend/.env.example"), "utf8")).resolves.toBe(
      renderEnvExample("backend"),
    );
    await expect(readFile(join(root, "apps/web/.env.example"), "utf8")).resolves.toBe(
      renderEnvExample("web"),
    );
  });

  it("contains every in-scope application environment read", async () => {
    expect(envManifest).toHaveLength(76);
    expect(envByKey.size).toBe(envManifest.length);
    expect(
      envReads("const url = `https://host/${process.env.URL_KEY}`; // process.env.NOPE"),
    ).toEqual(new Set(["URL_KEY"]));

    const files = (
      await Promise.all(sourceRoots.map((path) => sourceFiles(join(root, path))))
    ).flat();
    const missing = new Map<string, string[]>();
    for (const file of files) {
      for (const key of envReads(await readFile(file, "utf8"))) {
        if (!envByKey.has(key) && !sdkOnlyEnv.has(key)) {
          missing.set(key, [...(missing.get(key) ?? []), relative(root, file)]);
        }
      }
    }
    expect(Object.fromEntries(missing)).toEqual({});
  });
});
