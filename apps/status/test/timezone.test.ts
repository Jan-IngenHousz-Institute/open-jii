import { describe, expect, it } from "vitest";

describe("the test time zone", () => {
  it("is a zone with daylight saving that is not UTC", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Los_Angeles");
  });

  it("is on daylight time in summer and off it in winter", () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(420);
    expect(new Date(2026, 11, 1).getTimezoneOffset()).toBe(480);
  });
});
