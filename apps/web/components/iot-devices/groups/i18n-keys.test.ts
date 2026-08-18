import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import deIot from "@repo/i18n/locales/de-DE/iot.json";
import enIot from "@repo/i18n/locales/en-US/iot.json";
import nlIot from "@repo/i18n/locales/nl-NL/iot.json";

const COMPONENT_DIRS = [__dirname, join(__dirname, "..", "monitoring")];
const LOCALES = { "en-US": enIot, "de-DE": deIot, "nl-NL": nlIot };

/** Dotted-path lookup, treating `_one`/`_other` plural families as one key. */
function resolves(resource: unknown, key: string): boolean {
  let node: unknown = resource;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return false;
    const record: Record<string, unknown> = { ...node };
    if (part in record) {
      node = record[part];
    } else if (`${part}_other` in record) {
      return true;
    } else {
      return false;
    }
  }
  return typeof node === "string";
}

function referencedKeys(): { file: string; key: string }[] {
  const keys: { file: string; key: string }[] = [];
  for (const dir of COMPONENT_DIRS) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".tsx") || name.includes(".test.")) continue;
      const source = readFileSync(join(dir, name), "utf8");
      for (const match of source.matchAll(/t\("(iot\.[a-zA-Z0-9_.]+)"/g)) {
        keys.push({ file: name, key: match[1] });
      }
    }
  }
  return keys;
}

/**
 * Every literal key the monitoring surfaces reference must resolve in every
 * locale. Catches missing keys and keys inserted into the wrong namespace,
 * which render as raw key strings at runtime.
 */
describe("monitoring i18n keys", () => {
  const keys = referencedKeys();

  it("finds keys to check", () => {
    expect(keys.length).toBeGreaterThan(30);
  });

  it.each(Object.entries(LOCALES))("all resolve in %s", (_locale, resource) => {
    const missing = keys.filter(({ key }) => !resolves(resource, key));
    expect(missing).toEqual([]);
  });
});
