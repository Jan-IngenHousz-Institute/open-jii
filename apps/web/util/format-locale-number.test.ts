import { describe, expect, it } from "vitest";

import { formatLocaleNumber } from "./format-locale-number";

describe("formatLocaleNumber", () => {
  it("formats below a thousand without a separator", () => {
    expect(formatLocaleNumber(0, "en-US")).toBe("0");
    expect(formatLocaleNumber(42, "en-US")).toBe("42");
    expect(formatLocaleNumber(999, "en-US")).toBe("999");
  });

  it("comma-separates thousands and above for en-US", () => {
    expect(formatLocaleNumber(1000, "en-US")).toBe("1,000");
    expect(formatLocaleNumber(12345, "en-US")).toBe("12,345");
    expect(formatLocaleNumber(999999, "en-US")).toBe("999,999");
    expect(formatLocaleNumber(1000000, "en-US")).toBe("1,000,000");
    expect(formatLocaleNumber(1234567890, "en-US")).toBe("1,234,567,890");
  });

  it("handles negative numbers", () => {
    expect(formatLocaleNumber(-1, "en-US")).toBe("-1");
    expect(formatLocaleNumber(-12345, "en-US")).toBe("-12,345");
  });

  it("preserves decimals without adding or dropping precision", () => {
    expect(formatLocaleNumber(1234.5, "en-US")).toBe("1,234.5");
    expect(formatLocaleNumber(1234.567, "en-US")).toBe("1,234.567");
  });

  it("uses the given locale's grouping and decimal conventions", () => {
    expect(formatLocaleNumber(1234, "de-DE")).toBe("1.234");
    expect(formatLocaleNumber(1234.5, "de-DE")).toBe("1.234,5");
    expect(formatLocaleNumber(1234567, "fr-FR")).toBe("1 234 567");
  });
});
