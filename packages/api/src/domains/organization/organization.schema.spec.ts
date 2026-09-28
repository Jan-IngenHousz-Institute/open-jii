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
});
