import { describe, it, expect } from "vitest";

import { parseNumericArray } from "./parse-numeric-array";

describe("parseNumericArray", () => {
  it("passes an already-parsed array through unchanged", () => {
    expect(parseNumericArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("parses a JSON-array string", () => {
    expect(parseNumericArray("[1.5, 2.7, 3.9]")).toEqual([1.5, 2.7, 3.9]);
  });

  it("parses a comma-separated string", () => {
    expect(parseNumericArray("1.1,2.2,3.3")).toEqual([1.1, 2.2, 3.3]);
  });

  it("filters out NaN tokens from a comma-separated string", () => {
    expect(parseNumericArray("1,invalid,3,NaN,5")).toEqual([1, 3, 5]);
  });

  it("returns an empty array for an empty array literal string", () => {
    expect(parseNumericArray("[]")).toEqual([]);
  });

  it("returns an empty array for an unparseable string", () => {
    expect(parseNumericArray("invalid-data-that-cannot-be-parsed-[{")).toEqual([]);
  });
});
