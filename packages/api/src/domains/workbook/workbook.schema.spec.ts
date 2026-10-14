import { describe, expect, it } from "vitest";

import { zWorkbookFilterQuery } from "./workbook.schema";

describe("workbook list query", () => {
  it("accepts one or two allowed sort fields", () => {
    expect(
      zWorkbookFilterQuery.parse({
        sort: [
          { field: "usedBy", direction: "desc" },
          { field: "name", direction: "asc" },
        ],
      }).sort,
    ).toEqual([
      { field: "usedBy", direction: "desc" },
      { field: "name", direction: "asc" },
    ]);
  });

  it("rejects duplicate, unsupported, and third sort fields", () => {
    expect(
      zWorkbookFilterQuery.safeParse({
        sort: [
          { field: "name", direction: "asc" },
          { field: "name", direction: "desc" },
        ],
      }).success,
    ).toBe(false);
    expect(
      zWorkbookFilterQuery.safeParse({
        sort: [{ field: "activity", direction: "asc" }],
      }).success,
    ).toBe(false);
    expect(
      zWorkbookFilterQuery.safeParse({
        sort: [
          { field: "name", direction: "asc" },
          { field: "usedBy", direction: "asc" },
          { field: "updated", direction: "asc" },
        ],
      }).success,
    ).toBe(false);
  });

  it("turns one visibility into a list and keeps a list of them", () => {
    expect(zWorkbookFilterQuery.parse({ visibility: "public" }).visibility).toEqual(["public"]);
    expect(
      zWorkbookFilterQuery.parse({ visibility: ["private", "public", "private"] }).visibility,
    ).toEqual(["private", "public"]);
  });

  it("rejects an unknown visibility and leaves the filter optional", () => {
    expect(zWorkbookFilterQuery.safeParse({ visibility: "hidden" }).success).toBe(false);
    expect(zWorkbookFilterQuery.parse({}).visibility).toBeUndefined();
  });
});
