import { describe, expect, it } from "vitest";

import { parseCatalog, parsePasses } from "./catalog.js";

describe("parseCatalog", () => {
  it("returns the metrics list", () => {
    const parsed = parseCatalog("version: 1\nmetrics:\n  - num: 1\n    id: a\n    active: true\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("a");
  });

  it("tolerates a catalog with no metrics", () => {
    expect(parseCatalog("version: 1\n")).toEqual([]);
  });
});

describe("parsePasses", () => {
  it("returns the passes list, and nothing for a catalog without one", () => {
    const source = "passes:\n  - date: 2026-09-26\n    range: [1, 2]\n    note: n\n";

    expect(parsePasses(source)[0]?.range).toEqual([1, 2]);
    expect(parsePasses("version: 1\n")).toEqual([]);
  });
});
