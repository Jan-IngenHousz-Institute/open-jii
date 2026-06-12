import { describe, expect, it } from "vitest";
import { shouldHideSplash } from "~/shared/device/should-hide-splash";

describe("shouldHideSplash", () => {
  it("hides when fonts, migrations, i18n, and force-update are ready", () => {
    expect(shouldHideSplash(true, true, true, true, undefined)).toBe(true);
  });

  it("hides when migrations error, even if fonts/migrations not ready", () => {
    const err = new Error("migration boom");
    expect(shouldHideSplash(false, false, false, false, err)).toBe(true);
    expect(shouldHideSplash(true, false, false, false, err)).toBe(true);
    expect(shouldHideSplash(false, true, false, false, err)).toBe(true);
  });

  it("keeps splash while fonts loading", () => {
    expect(shouldHideSplash(false, true, true, true, undefined)).toBe(false);
  });

  it("keeps splash while migrations running", () => {
    expect(shouldHideSplash(true, false, true, true, undefined)).toBe(false);
  });

  it("keeps splash while i18n is loading", () => {
    expect(shouldHideSplash(true, true, false, true, undefined)).toBe(false);
  });

  it("keeps splash while force-update status is checking", () => {
    expect(shouldHideSplash(true, true, true, false, undefined)).toBe(false);
  });

  it("keeps splash when nothing ready and no error", () => {
    expect(shouldHideSplash(false, false, false, false, undefined)).toBe(false);
  });
});
