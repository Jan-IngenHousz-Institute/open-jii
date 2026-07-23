import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { checkLocaleParity, formatLocaleParityIssue } from "./locale-parity.js";

const fixtures = resolve(import.meta.dirname, "test-fixtures/locales");

describe("host-parameterized locale parity", () => {
  it("reports missing, extra, and retired keys with host, locale, and namespace", async () => {
    const issues = await checkLocaleParity({
      host: "fixture-host",
      base: { locale: "en-US", root: resolve(fixtures, "en-US") },
      siblings: [{ locale: "nl-NL", root: resolve(fixtures, "nl-NL") }],
      retiredKeys: ["common.device.genericMultispeq"],
    });

    expect(issues).toEqual([
      {
        host: "fixture-host",
        locale: "nl-NL",
        namespace: "common",
        key: "device.genericMultispeq",
        kind: "extra",
      },
      {
        host: "fixture-host",
        locale: "nl-NL",
        namespace: "common",
        key: "device.genericMultispeq",
        kind: "retired",
      },
      {
        host: "fixture-host",
        locale: "nl-NL",
        namespace: "common",
        key: "device.summary",
        kind: "missing",
      },
      {
        host: "fixture-host",
        locale: "nl-NL",
        namespace: "common",
        key: "unexpected",
        kind: "extra",
      },
    ]);
    expect(issues.map(formatLocaleParityIssue).at(0)).toBe(
      "fixture-host/nl-NL/common: extra key device.genericMultispeq",
    );
  });

  it("accepts any number of sibling locale trees, including none", async () => {
    await expect(
      checkLocaleParity({
        host: "fixture-host",
        base: { locale: "en-US", root: resolve(fixtures, "en-US") },
        siblings: [],
        retiredKeys: [],
      }),
    ).resolves.toEqual([]);
  });
});
