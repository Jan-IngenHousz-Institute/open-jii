import { describe, expect, it } from "vitest";

import { zOrganizationDirectoryQuery } from "./organization.schema";

describe("organization directory query", () => {
  it("accepts one or two allowed sort fields", () => {
    expect(
      zOrganizationDirectoryQuery.parse({
        sort: [
          { field: "members", direction: "desc" },
          { field: "name", direction: "asc" },
        ],
      }).sort,
    ).toEqual([
      { field: "members", direction: "desc" },
      { field: "name", direction: "asc" },
    ]);
  });

  it("accepts type as the only or the second sort field", () => {
    expect(
      zOrganizationDirectoryQuery.parse({ sort: [{ field: "type", direction: "asc" }] }).sort,
    ).toEqual([{ field: "type", direction: "asc" }]);
    expect(
      zOrganizationDirectoryQuery.parse({
        sort: [
          { field: "name", direction: "asc" },
          { field: "type", direction: "desc" },
        ],
      }).sort,
    ).toEqual([
      { field: "name", direction: "asc" },
      { field: "type", direction: "desc" },
    ]);
  });

  it("leaves the sort optional", () => {
    expect(zOrganizationDirectoryQuery.parse({}).sort).toBeUndefined();
  });

  it("rejects duplicate, unsupported, and third sort fields", () => {
    expect(
      zOrganizationDirectoryQuery.safeParse({
        sort: [
          { field: "name", direction: "asc" },
          { field: "name", direction: "desc" },
        ],
      }).success,
    ).toBe(false);
    expect(
      zOrganizationDirectoryQuery.safeParse({
        sort: [{ field: "updated", direction: "asc" }],
      }).success,
    ).toBe(false);
    expect(
      zOrganizationDirectoryQuery.safeParse({
        sort: [
          { field: "name", direction: "asc" },
          { field: "members", direction: "asc" },
          { field: "resources", direction: "asc" },
        ],
      }).success,
    ).toBe(false);
  });

  it("turns a single type into an array", () => {
    expect(zOrganizationDirectoryQuery.parse({ type: "university" }).type).toEqual(["university"]);
  });

  it("passes a type array through without duplicates", () => {
    expect(
      zOrganizationDirectoryQuery.parse({ type: ["university", "non_profit", "university"] }).type,
    ).toEqual(["university", "non_profit"]);
  });

  it("rejects an unknown type", () => {
    expect(zOrganizationDirectoryQuery.safeParse({ type: "lab" }).success).toBe(false);
    expect(zOrganizationDirectoryQuery.safeParse({ type: ["university", "lab"] }).success).toBe(
      false,
    );
  });

  it("leaves the type filter optional", () => {
    expect(zOrganizationDirectoryQuery.parse({}).type).toBeUndefined();
  });
});
