import { describe, expect, it } from "vitest";

import { formatCoefficientValue } from "./format-coefficient-value";

describe("formatCoefficientValue", () => {
  it("formats a scalar coefficient", () => {
    expect(formatCoefficientValue(1.1893)).toBe("1.1893");
  });

  it("formats an integer array coefficient entry by entry", () => {
    expect(formatCoefficientValue([1021, 987, 1103])).toBe("[1021, 987, 1103]");
  });
});
