import { describe, it, expect, vi } from "vitest";

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

  it("filters out Infinity and -Infinity tokens from a comma-separated string", () => {
    expect(parseNumericArray("1,Infinity,3,-Infinity,5")).toEqual([1, 3, 5]);
  });

  it("filters out Infinity and -Infinity values from a JSON-array string", () => {
    expect(parseNumericArray("[1, Infinity, 3, -Infinity, 5]")).toEqual([1, 3, 5]);
  });

  it("filters out NaN and non-finite values from an already-parsed array", () => {
    expect(parseNumericArray([1, NaN, 3, Infinity, -Infinity, 5])).toEqual([1, 3, 5]);
  });

  it("returns an empty array for an empty array literal string", () => {
    expect(parseNumericArray("[]")).toEqual([]);
  });

  it("returns an empty array for an unparseable string", () => {
    expect(parseNumericArray("invalid-data-that-cannot-be-parsed-[{")).toEqual([]);
  });

  it("returns an empty array when stripping brackets leaves nothing, after JSON.parse fails", () => {
    // "[" alone isn't valid JSON, so it falls through to the comma-separated
    // fallback, where stripping the leading bracket leaves an empty string.
    expect(parseNumericArray("[")).toEqual([]);
  });

  it("returns an empty array when the string parses as valid JSON that isn't an array", () => {
    expect(parseNumericArray('{"not": "an array"}')).toEqual([]);
  });

  it("warns and returns an empty array when the comma-separated fallback itself throws", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const replaceSpy = vi.spyOn(String.prototype, "replace").mockImplementationOnce(() => {
      throw new Error("boom");
    });

    expect(parseNumericArray("not json, falls through to the fallback")).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, details] = warnSpy.mock.calls[0] as [string, { value: string; error: unknown }];
    expect(details.error).toBeInstanceOf(Error);

    replaceSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
