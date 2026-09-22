import { describe, expect, it } from "vitest";

import { formatValue } from "./format.js";

describe("formatValue", () => {
  it("reads an iterator age as a duration, which is the case that started this", () => {
    // 8797000 rendered as "8.8M" in the first digest that ever reached Slack.
    expect(formatValue(8_797_000, "milliseconds")).toBe("2h 27m");
    expect(formatValue(600_000, "milliseconds")).toBe("10m");
  });

  it("scales a duration to the unit someone would say it in", () => {
    expect(formatValue(850, "milliseconds")).toBe("850ms");
    expect(formatValue(3.03, "seconds")).toBe("3.0s");
    expect(formatValue(45_000, "milliseconds")).toBe("45s");
    expect(formatValue(12.6, "minutes")).toBe("13m");
    expect(formatValue(7_200_000, "milliseconds")).toBe("2h");
    expect(formatValue(200_000_000, "milliseconds")).toBe("2d 8h");
  });

  it("drops the minutes when an hour lands clean, rather than printing 2h 0m", () => {
    expect(formatValue(2 * 60 * 60_000, "milliseconds")).toBe("2h");
  });

  it("sizes bytes", () => {
    expect(formatValue(66_322_432, "bytes")).toBe("63.3 MB");
    expect(formatValue(512, "bytes")).toBe("512 B");
    expect(formatValue(5_368_709_120, "bytes")).toBe("5.0 GB");
  });

  it("keeps two decimals on a sub-one-percent rate, where the signal lives", () => {
    expect(formatValue(0.0165892, "percent")).toBe("0.02%");
    expect(formatValue(4.2, "percent")).toBe("4.2%");
    expect(formatValue(400, "percent")).toBe("400%");
  });

  it("abbreviates a plain count, with or without a declared unit", () => {
    expect(formatValue(3_700)).toBe("3.7k");
    expect(formatValue(2_400_000)).toBe("2.4M");
    expect(formatValue(7)).toBe("7");
    expect(formatValue(1.5)).toBe("1.50");
  });

  it("falls back to a count for a unit it does not know", () => {
    // A catalog entry may declare something the formatter has not learned yet; that
    // should read as a bare number rather than throw in a Lambda at 06:30.
    expect(formatValue(3_700, "furlongs")).toBe("3.7k");
  });
});
