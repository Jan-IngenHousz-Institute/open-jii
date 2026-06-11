import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("returns uppercase first-letter for two-part names", () => {
    expect(initialsOf("Jane Doe")).toBe("JD");
  });

  it("uppercases regardless of input case", () => {
    expect(initialsOf("jane doe")).toBe("JD");
  });

  it("caps at the first two parts and ignores trailing parts", () => {
    expect(initialsOf("Mary Jane Watson")).toBe("MJ");
  });

  it("returns a single initial for single-word names", () => {
    expect(initialsOf("Madonna")).toBe("M");
  });

  it("collapses interior whitespace so double-spaces don't yield empty initials", () => {
    expect(initialsOf("Jane   Doe")).toBe("JD");
  });

  it("ignores leading and trailing whitespace", () => {
    expect(initialsOf("  Jane Doe  ")).toBe("JD");
  });

  it("returns an empty string for an empty name", () => {
    expect(initialsOf("")).toBe("");
  });

  it("returns an empty string when the name is only whitespace", () => {
    expect(initialsOf("   ")).toBe("");
  });

  it("preserves non-ASCII initials with locale-sensitive uppercase", () => {
    expect(initialsOf("Élodie Müller")).toBe("ÉM");
  });
});
