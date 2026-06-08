import { describe, expect, it } from "vitest";
import { shouldHideSplash } from "~/shared/device/should-hide-splash";

describe("shouldHideSplash", () => {
  it("hides when fonts loaded and migrations ready", () => {
    expect(shouldHideSplash(true, true, undefined)).toBe(true);
  });

  it("hides when migrations error, even if fonts/migrations not ready", () => {
    const err = new Error("migration boom");
    expect(shouldHideSplash(false, false, err)).toBe(true);
    expect(shouldHideSplash(true, false, err)).toBe(true);
    expect(shouldHideSplash(false, true, err)).toBe(true);
  });

  it("keeps splash while fonts loading", () => {
    expect(shouldHideSplash(false, true, undefined)).toBe(false);
  });

  it("keeps splash while migrations running", () => {
    expect(shouldHideSplash(true, false, undefined)).toBe(false);
  });

  it("keeps splash when nothing ready and no error", () => {
    expect(shouldHideSplash(false, false, undefined)).toBe(false);
  });
});
