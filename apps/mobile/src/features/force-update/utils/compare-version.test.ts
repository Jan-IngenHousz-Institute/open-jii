import { describe, expect, it } from "vitest";

import { isVersionBelow } from "./compare-version";

describe("isVersionBelow", () => {
  it("is true when current is older", () => {
    expect(isVersionBelow("1.0.0", "1.1.0")).toBe(true);
    expect(isVersionBelow("1.1.0", "2.0.0")).toBe(true);
    expect(isVersionBelow("1.4.9", "1.4.10")).toBe(true);
  });

  it("is false when current equals minimum", () => {
    expect(isVersionBelow("1.4.0", "1.4.0")).toBe(false);
  });

  it("is false when current is newer", () => {
    expect(isVersionBelow("2.0.0", "1.9.9")).toBe(false);
    expect(isVersionBelow("1.5.0", "1.4.9")).toBe(false);
  });

  it("pads missing segments with zero", () => {
    expect(isVersionBelow("1.2", "1.2.0")).toBe(false);
    expect(isVersionBelow("1.2", "1.2.1")).toBe(true);
    expect(isVersionBelow("1", "1.0.1")).toBe(true);
  });

  it("ignores prerelease / build suffixes", () => {
    expect(isVersionBelow("1.4.0-beta.1", "1.4.0")).toBe(false);
    expect(isVersionBelow("1.3.0+build7", "1.4.0")).toBe(true);
  });

  it("fails safe (no gating) on unparseable input", () => {
    expect(isVersionBelow("", "1.0.0")).toBe(false);
    expect(isVersionBelow("garbage", "1.0.0")).toBe(false);
    expect(isVersionBelow("1.0.0", "")).toBe(false);
    expect(isVersionBelow("1.0.0", "x.y.z")).toBe(false);
    expect(isVersionBelow("1.0.0.0", "1.0.0")).toBe(false);
  });

  it("fails safe on empty version segments", () => {
    expect(isVersionBelow("1..2", "2.0.0")).toBe(false);
    expect(isVersionBelow(".1", "1.0.0")).toBe(false);
    expect(isVersionBelow("1.", "2.0.0")).toBe(false);
    expect(isVersionBelow("1.0.0", "1..2")).toBe(false);
  });
});
