import { createOrganizationResource } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { OrganizationResourceType } from "@repo/api/domains/organization/organization.schema";

import {
  DEFAULT_RESOURCE_FILTER,
  filterAndSortResources,
  hasActiveFilters,
} from "./organization-resource-filter";

function resource(
  name: string,
  extra: { type?: OrganizationResourceType; updatedAt?: string; description?: string | null } = {},
) {
  return createOrganizationResource({
    name,
    id: name.toLowerCase().replace(/\s+/gu, "-"),
    type: extra.type ?? "experiment",
    updatedAt: extra.updatedAt ?? "2026-01-01T00:00:00.000Z",
    description: extra.description ?? null,
  });
}

const namesOf = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("filterAndSortResources", () => {
  describe("search", () => {
    it("matches the name, case-insensitively and on a substring", () => {
      const rows = [resource("Drought stress"), resource("Canopy series")];

      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, query: "DROUGHT" })),
      ).toEqual(["Drought stress"]);
      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, query: "opy ser" })),
      ).toEqual(["Canopy series"]);
    });

    /**
     * Names only, by decision. A word that appears **only** in a description must not
     * match — this is the assertion that pins the choice, since one that searched a
     * matching name would pass either way.
     */
    it("does not match a word that appears only in the description", () => {
      const rows = [
        resource("Drought stress", { description: "<p>Rain-out shelter, 12 plots</p>" }),
      ];

      expect(
        filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, query: "shelter" }),
      ).toEqual([]);
      // And the row is genuinely reachable, so the empty result above is the filter
      // working rather than the fixture being wrong.
      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, query: "drought" })),
      ).toEqual(["Drought stress"]);
    });

    it("ignores surrounding whitespace and treats a blank query as no filter", () => {
      const rows = [resource("Drought stress"), resource("Canopy series")];

      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, query: "  drought  " })),
      ).toEqual(["Drought stress"]);
      expect(
        filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, query: "   " }),
      ).toHaveLength(2);
    });
  });

  describe("type filter", () => {
    it("narrows to one type and back", () => {
      const rows = [
        resource("Campaign", { type: "experiment" }),
        resource("Dark adaptation", { type: "protocol" }),
        resource("Ambyte 04", { type: "device" }),
      ];

      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, type: "protocol" })),
      ).toEqual(["Dark adaptation"]);
      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, type: "device" })),
      ).toEqual(["Ambyte 04"]);
      expect(filterAndSortResources(rows, DEFAULT_RESOURCE_FILTER)).toHaveLength(3);
    });

    it("combines with the search rather than replacing it", () => {
      const rows = [
        resource("Canopy campaign", { type: "experiment" }),
        resource("Canopy protocol", { type: "protocol" }),
      ];

      expect(
        namesOf(
          filterAndSortResources(rows, {
            ...DEFAULT_RESOURCE_FILTER,
            query: "canopy",
            type: "protocol",
          }),
        ),
      ).toEqual(["Canopy protocol"]);
    });
  });

  describe("sort", () => {
    it("defaults to most recently updated first", () => {
      const rows = [
        resource("Older", { updatedAt: "2026-01-01T00:00:00.000Z" }),
        resource("Newest", { updatedAt: "2026-03-01T00:00:00.000Z" }),
        resource("Middle", { updatedAt: "2026-02-01T00:00:00.000Z" }),
      ];

      expect(DEFAULT_RESOURCE_FILTER.sort).toBe("recent");
      expect(namesOf(filterAndSortResources(rows, DEFAULT_RESOURCE_FILTER))).toEqual([
        "Newest",
        "Middle",
        "Older",
      ]);
    });

    it("sorts by name alphabetically", () => {
      const rows = [resource("Zebra"), resource("apple"), resource("Mango")];

      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, sort: "name" })),
      ).toEqual(["apple", "Mango", "Zebra"]);
    });

    it("sorts by type in the shared group order, recency inside each type", () => {
      const rows = [
        resource("A device", { type: "device" }),
        resource("A workbook", { type: "workbook" }),
        resource("Older experiment", { type: "experiment", updatedAt: "2026-01-01T00:00:00.000Z" }),
        resource("Newer experiment", { type: "experiment", updatedAt: "2026-05-01T00:00:00.000Z" }),
        resource("A macro", { type: "macro" }),
        resource("A protocol", { type: "protocol" }),
      ];

      // experiment, protocol, macro, workbook, device — the order the featured card
      // rotates through and the estate bar segments by.
      expect(
        namesOf(filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, sort: "type" })),
      ).toEqual([
        "Newer experiment",
        "Older experiment",
        "A protocol",
        "A macro",
        "A workbook",
        "A device",
      ]);
    });
  });

  it("does not reorder or consume the caller's array", () => {
    // The featured card renders from the same array; sorting it in place would reorder
    // what that card shows as a side effect of typing in this one's search box.
    const rows = [
      resource("Older", { updatedAt: "2026-01-01T00:00:00.000Z" }),
      resource("Newest", { updatedAt: "2026-03-01T00:00:00.000Z" }),
    ];

    filterAndSortResources(rows, { ...DEFAULT_RESOURCE_FILTER, sort: "name" });

    expect(namesOf(rows)).toEqual(["Older", "Newest"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default state and true once something narrows", () => {
    expect(hasActiveFilters(DEFAULT_RESOURCE_FILTER)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_RESOURCE_FILTER, query: "x" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_RESOURCE_FILTER, type: "macro" })).toBe(true);
  });

  it("ignores a whitespace-only query and the sort", () => {
    expect(hasActiveFilters({ ...DEFAULT_RESOURCE_FILTER, query: "   " })).toBe(false);
    // Sort arranges, it does not narrow — so it must not make "Clear filters" appear.
    expect(hasActiveFilters({ ...DEFAULT_RESOURCE_FILTER, sort: "name" })).toBe(false);
  });
});
