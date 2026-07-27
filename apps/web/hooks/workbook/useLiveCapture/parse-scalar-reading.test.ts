import { describe, expect, it } from "vitest";

import { parseScalarReading } from "./parse-scalar-reading";

describe("parseScalarReading", () => {
  it("passes finite numbers through", () => {
    expect(parseScalarReading(345.61)).toBe(345.61);
    expect(parseScalarReading(0)).toBe(0);
    expect(parseScalarReading(-12.5)).toBe(-12.5);
  });

  it("rejects non-finite numbers", () => {
    expect(parseScalarReading(NaN)).toBeNull();
    expect(parseScalarReading(Infinity)).toBeNull();
  });

  it("parses numeric strings, ignoring surrounding whitespace", () => {
    expect(parseScalarReading("342.55")).toBe(342.55);
    expect(parseScalarReading("  17\n")).toBe(17);
  });

  it("rejects non-numeric and empty strings", () => {
    expect(parseScalarReading("NaN")).toBeNull();
    expect(parseScalarReading("error:unknown_command")).toBeNull();
    expect(parseScalarReading("")).toBeNull();
    expect(parseScalarReading("   \n")).toBeNull();
  });

  it("rejects structured replies (envelopes, arrays, null)", () => {
    expect(parseScalarReading({ sample: [{ set: [{ label: "par", par: 340 }] }] })).toBeNull();
    expect(parseScalarReading([340])).toBeNull();
    expect(parseScalarReading(null)).toBeNull();
    expect(parseScalarReading(undefined)).toBeNull();
  });
});
