import { describe, expect, it } from "vitest";

import { guestLifetime } from "./guest-lifetime";

const created = "2026-10-01T00:00:00Z";
const start = Date.parse(created);
const deadline = start + 7 * 24 * 60 * 60 * 1000;

describe("offline guest lifetime", () => {
  it.each([
    [deadline - 1, true],
    [deadline, false],
    [deadline + 1, false],
  ] as const)("checks the original seven-day deadline at %s", (now, valid) => {
    expect(guestLifetime(created, now, start).valid).toBe(valid);
  });
  it.each([undefined, "not a date", "2099-01-01"])(
    "rejects an untrusted creation date %s",
    (date) => {
      expect(guestLifetime(date, start, start).valid).toBe(false);
    },
  );
  it("detects rollback after an offline observation or restart", () => {
    const last = guestLifetime(created, start + 3_600_000, start).highWater;
    expect(guestLifetime(created, start, last).valid).toBe(false);
    expect(guestLifetime(created, start + 3_600_000 - 1000, last)).toEqual({
      valid: true,
      highWater: last,
    });
  });
  it("never lets a small correction extend the deadline", () => {
    expect(guestLifetime(created, deadline - 1_000, deadline).valid).toBe(false);
  });
});
