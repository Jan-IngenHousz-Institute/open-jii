import { describe, it, expect } from "vitest";

import { isGuestEmail, zGuestName } from "./guest";

describe("guest names", () => {
  it.each([
    ["  Ada  ", "Ada"],
    ["", "Guest"],
    ["   ", "Guest"],
    ["Élodie 李", "Élodie 李"],
    ["a".repeat(60), "a".repeat(60)],
  ])("normalizes %s", (input, expected) => {
    expect(zGuestName.parse(input)).toBe(expected);
  });

  it.each([
    null,
    1,
    {},
    "a".repeat(61),
    "https://example.org",
    "www.example.org",
    "example.org",
    "river@lab",
    "@river",
  ])("rejects %s", (name) => expect(zGuestName.safeParse(name).success).toBe(false));

  it("recognizes only the reserved guest email domain", () => {
    expect(isGuestEmail("TEMP@GUEST.OPENJII.INVALID")).toBe(true);
    expect(isGuestEmail("test@example.org")).toBe(false);
    expect(isGuestEmail("test@guest.openjii.invalid.example.org")).toBe(false);
  });
});
