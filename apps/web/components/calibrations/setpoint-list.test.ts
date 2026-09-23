import { describe, expect, it } from "vitest";

import { formatSetpoints, numericSetpoints, parseSetpoints } from "./setpoint-list";

describe("parseSetpoints", () => {
  it("reads a comma-separated list of numbers", () => {
    expect(parseSetpoints("0.8, 2.4,3", true)).toEqual([0.8, 2.4, 3]);
  });

  // Committing "0.8, " as one point would drop what the author was still typing.
  it("ignores a trailing separator rather than reading it as a point", () => {
    expect(parseSetpoints("0.8, ", true)).toEqual([0.8]);
  });

  it("refuses a label where an instrument needs a number", () => {
    expect(parseSetpoints("0.8, dim", true)).toBeNull();
  });

  it("keeps a label the operator steps through", () => {
    expect(parseSetpoints("0.8, dim", false)).toEqual([0.8, "dim"]);
  });

  it("refuses an empty list and one past the contract's limit", () => {
    expect(parseSetpoints(" , ", true)).toBeNull();
    expect(
      parseSetpoints(Array.from({ length: 65 }, (_, i) => String(i)).join(","), true),
    ).toBeNull();
  });
});

describe("formatSetpoints", () => {
  it("writes the list back the way it is typed", () => {
    expect(formatSetpoints([0.8, "dim", 3])).toBe("0.8, dim, 3");
  });
});

describe("numericSetpoints", () => {
  it("keeps only the points an instrument can be driven to", () => {
    expect(numericSetpoints([0.8, "dim", 3])).toEqual([0.8, 3]);
  });
});
