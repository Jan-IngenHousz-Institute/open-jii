import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildMacroInputShapeFingerprint } from "./macro-execution.model";

interface ShapeFingerprintFields {
  typeof: string;
  isArray: boolean;
  length: number | null;
  topLevelKeys: string[];
  setIsArray: boolean;
  setTypeof: string;
  setLength: number | null;
  setLabels: string[];
}

interface ShapeFingerprintFixtures {
  fixtureVersion: number;
  privacySentinels: string[];
  cases: {
    name: string;
    data: unknown;
    assertRoundTrip?: boolean;
    expected: ShapeFingerprintFields;
  }[];
}

const fixtures = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../../../../../../packages/api/fixtures/macro-input-shape-fingerprints.json",
    ),
    "utf8",
  ),
) as ShapeFingerprintFixtures;

describe("buildMacroInputShapeFingerprint", () => {
  it.each(fixtures.cases)("matches the canonical $name fixture", ({ data, expected }) => {
    const fingerprint = buildMacroInputShapeFingerprint(data, "macro-fixture", "workbook-fixture");

    expect(fingerprint).toEqual({
      ...expected,
      macro_id: "macro-fixture",
      workbook_version_id: "workbook-fixture",
    });

    const serialized = JSON.stringify(fingerprint);
    for (const sentinel of fixtures.privacySentinels) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("uses the versioned shared fixture contract", () => {
    expect(fixtures.fixtureVersion).toBe(2);
  });
});
