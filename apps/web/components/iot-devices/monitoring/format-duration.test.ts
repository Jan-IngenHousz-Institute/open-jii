import { describe, expect, it } from "vitest";

import { formatDurationShort } from "./format-duration";

describe("formatDurationShort", () => {
  it("drops to seconds under a minute, so brief outages stay visible", () => {
    expect(formatDurationShort(0)).toBe("0s");
    expect(formatDurationShort(45)).toBe("45s");
  });

  it("reads minutes under an hour", () => {
    expect(formatDurationShort(5 * 60)).toBe("5m");
    expect(formatDurationShort(59 * 60 + 59)).toBe("59m");
  });

  it("reads hours and minutes under a day", () => {
    expect(formatDurationShort(3 * 3600 + 15 * 60)).toBe("3h 15m");
  });

  it("reads days and hours beyond that, rolling months and years back into days", () => {
    expect(formatDurationShort(2 * 86400 + 4 * 3600)).toBe("2d 4h");
    expect(formatDurationShort(400 * 86400)).toBe("400d 0h");
  });
});
