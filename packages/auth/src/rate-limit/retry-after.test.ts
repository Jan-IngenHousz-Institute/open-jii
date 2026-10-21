import { describe, expect, it, vi } from "vitest";

import { retryAfterSeconds } from "./retry-after";

describe("retry guidance", () => {
  it.each([
    ["900", 900],
    ["1.2", 2],
    ["0", 1],
    ["invalid", undefined],
    ["-1", undefined],
  ])("reads %s", (value, expected) => {
    expect(retryAfterSeconds(new Headers({ "Retry-After": value }))).toBe(expected);
  });
  it("accepts Better Auth's header and HTTP-date values", () => {
    expect(retryAfterSeconds(new Headers({ "X-Retry-After": "60" }))).toBe(60);
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-21T10:00:00Z"));
    expect(retryAfterSeconds(new Headers({ "Retry-After": "Wed, 21 Oct 2026 10:01:00 GMT" }))).toBe(
      60,
    );
    vi.restoreAllMocks();
  });
  it("leaves the retry time unknown when no header exists", () =>
    expect(retryAfterSeconds(new Headers())).toBeUndefined());
});
