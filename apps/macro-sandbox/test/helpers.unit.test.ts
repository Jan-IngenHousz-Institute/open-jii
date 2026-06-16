import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { describe, it, expect, beforeAll } from "vitest";

/**
 * Loads helpers.js the same way the JS wrapper does — by evaluating the file
 * source in a fresh VM context (see lib/wrappers/wrapper.js). This exercises
 * the actually-shipped file rather than a copy, so the regression guards below
 * cover exactly what runs in the Lambda.
 */
const helpersPath = fileURLToPath(new URL("../lib/helpers/helpers.js", import.meta.url));

interface HelperApi {
  GetProtocolByLabel: (label: string, json: unknown, array?: boolean) => unknown;
  GetIndexByLabel: (label: string, json: unknown, array?: boolean) => unknown;
  GetLabelLookup: (json: unknown) => unknown;
}

function loadHelpers(): HelperApi {
  const src = readFileSync(helpersPath, "utf8");
  const sandbox: Record<string, unknown> = { Math, JSON, console };
  const ctx = createContext(sandbox);
  runInContext(
    `${src}
    this.GetProtocolByLabel = GetProtocolByLabel;
    this.GetIndexByLabel = GetIndexByLabel;
    this.GetLabelLookup = GetLabelLookup;`,
    ctx,
  );
  return sandbox as unknown as HelperApi;
}

describe("macro helpers: label lookups", () => {
  let h: HelperApi;
  beforeAll(() => {
    h = loadHelpers();
  });

  const data = {
    set: [
      { label: "autogain", a: 1 },
      { label: "PAM", a: 2 },
      { label: "autogain", a: 3 },
    ],
  };

  describe("GetProtocolByLabel", () => {
    // Regression: previously threw "Cannot read properties of undefined
    // (reading 'filter')" when the input had no `set` array.
    it("returns null when json is undefined instead of throwing", () => {
      expect(h.GetProtocolByLabel("autogain", undefined, true)).toBeNull();
    });

    it("returns null when json.set is missing instead of throwing", () => {
      expect(h.GetProtocolByLabel("autogain", {}, true)).toBeNull();
    });

    it("returns a single protocol object when one match and array is false", () => {
      expect(h.GetProtocolByLabel("PAM", data, false)).toEqual({ label: "PAM", a: 2 });
    });

    it("wraps a single match in an array when array is true", () => {
      expect(h.GetProtocolByLabel("PAM", data, true)).toEqual([{ label: "PAM", a: 2 }]);
    });

    it("returns every match as an array when the label is duplicated", () => {
      expect(h.GetProtocolByLabel("autogain", data)).toEqual([
        { label: "autogain", a: 1 },
        { label: "autogain", a: 3 },
      ]);
    });

    it("returns null when no protocol matches the label", () => {
      expect(h.GetProtocolByLabel("missing", data, true)).toBeNull();
    });
  });

  describe("GetIndexByLabel", () => {
    it("returns null when json is undefined instead of throwing", () => {
      expect(h.GetIndexByLabel("autogain", undefined, true)).toBeNull();
    });

    it("returns null when json.set is missing instead of throwing", () => {
      expect(h.GetIndexByLabel("autogain", {}, true)).toBeNull();
    });

    it("returns a single index when one match and array is false", () => {
      expect(h.GetIndexByLabel("PAM", data, false)).toBe(1);
    });

    it("returns every matching index as an array", () => {
      expect(h.GetIndexByLabel("autogain", data, true)).toEqual([0, 2]);
    });

    it("returns null when no index matches the label", () => {
      expect(h.GetIndexByLabel("missing", data, true)).toBeNull();
    });
  });
});
