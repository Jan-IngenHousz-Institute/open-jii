import { describe, expect, it } from "vitest";

import { formatRange, formatSpan } from "./format-range";

describe("formatSpan", () => {
  it("keeps a span and its unit on one line", () => {
    expect(formatSpan({ min: 0.1, max: 10, unit: "A" })).toBe("0.1\u2060…\u206010\u00a0A");
  });
});

describe("formatRange", () => {
  it("leaves a line nowhere to break inside the range", () => {
    const range = formatRange({ name: "voltage_v", min: 0, max: 32, unit: "V" });

    expect(range).toBe("voltage_v\u00a00\u2060…\u206032\u00a0V");
    expect(range).not.toMatch(/ /);
  });
});
