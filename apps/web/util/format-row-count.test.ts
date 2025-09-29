import { describe, it, expect } from "vitest";

import { formatRowCount } from "./format-row-count";

describe("formatRowCount", () => {
  it("should format small numbers without suffix", () => {
    expect(formatRowCount(0)).toBe("0");
    expect(formatRowCount(1)).toBe("1");
    expect(formatRowCount(42)).toBe("42");
    expect(formatRowCount(999)).toBe("999");
  });

  it("should format thousands with K suffix", () => {
    expect(formatRowCount(1000)).toBe("1.0K");
    expect(formatRowCount(1500)).toBe("1.5K");
    expect(formatRowCount(2000)).toBe("2.0K");
    expect(formatRowCount(25000)).toBe("25.0K");
    expect(formatRowCount(125500)).toBe("125.5K");
    expect(formatRowCount(999000)).toBe("999.0K");
    expect(formatRowCount(999999)).toBe("1000.0K");
  });

  it("should format millions with M suffix", () => {
    expect(formatRowCount(1000000)).toBe("1.0M");
    expect(formatRowCount(1500000)).toBe("1.5M");
    expect(formatRowCount(2000000)).toBe("2.0M");
    expect(formatRowCount(25000000)).toBe("25.0M");
    expect(formatRowCount(125500000)).toBe("125.5M");
    expect(formatRowCount(999000000)).toBe("999.0M");
  });

  it("should handle edge cases correctly", () => {
    expect(formatRowCount(999)).toBe("999");
    expect(formatRowCount(1000)).toBe("1.0K");
    expect(formatRowCount(999999)).toBe("1000.0K");
    expect(formatRowCount(1000000)).toBe("1.0M");
  });

  it("should round to one decimal place", () => {
    expect(formatRowCount(1234)).toBe("1.2K");
    expect(formatRowCount(1678)).toBe("1.7K");
    expect(formatRowCount(1234567)).toBe("1.2M");
    expect(formatRowCount(1678901)).toBe("1.7M");
  });
});
