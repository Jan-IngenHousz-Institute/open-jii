import { describe, expect, it } from "vitest";

import { sortByNameAndUpdated, zNameUpdatedSort } from "./name-updated-sort";

const rows = [
  { name: "Beta", updatedAt: "2026-01-01T00:00:00.000Z" },
  { name: "alpha", updatedAt: "2026-03-01T00:00:00.000Z" },
  { name: "Beta", updatedAt: "2026-02-01T00:00:00.000Z" },
  { name: "Gamma", updatedAt: "2026-04-01T00:00:00.000Z" },
];

const order = (sorted: typeof rows) =>
  sorted.map((row) => `${row.name}@${row.updatedAt.slice(5, 7)}`);

describe("sortByNameAndUpdated", () => {
  it("puts the newest update first when there is no sort", () => {
    expect(order(sortByNameAndUpdated(rows, []))).toEqual([
      "Gamma@04",
      "alpha@03",
      "Beta@02",
      "Beta@01",
    ]);
  });

  it("sorts by name either way, breaking ties by the newest update", () => {
    expect(order(sortByNameAndUpdated(rows, [{ field: "name", direction: "asc" }]))).toEqual([
      "alpha@03",
      "Beta@02",
      "Beta@01",
      "Gamma@04",
    ]);
    expect(order(sortByNameAndUpdated(rows, [{ field: "name", direction: "desc" }]))).toEqual([
      "Gamma@04",
      "Beta@02",
      "Beta@01",
      "alpha@03",
    ]);
  });

  it("sorts oldest update first on request", () => {
    expect(order(sortByNameAndUpdated(rows, [{ field: "updatedAt", direction: "asc" }]))[0]).toBe(
      "Beta@01",
    );
  });

  it("applies a second sort to what the first leaves tied", () => {
    expect(
      order(
        sortByNameAndUpdated(rows, [
          { field: "name", direction: "asc" },
          { field: "updatedAt", direction: "asc" },
        ]),
      ),
    ).toEqual(["alpha@03", "Beta@01", "Beta@02", "Gamma@04"]);
  });

  it("leaves the caller's array alone", () => {
    const copy = [...rows];
    sortByNameAndUpdated(rows, [{ field: "name", direction: "asc" }]);
    expect(rows).toEqual(copy);
  });
});

describe("zNameUpdatedSort", () => {
  it("accepts name and updatedAt and nothing else", () => {
    expect(zNameUpdatedSort.safeParse([{ field: "name", direction: "asc" }]).success).toBe(true);
    expect(zNameUpdatedSort.safeParse([{ field: "widgets", direction: "asc" }]).success).toBe(
      false,
    );
  });
});
