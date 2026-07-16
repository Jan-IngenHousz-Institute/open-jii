import { describe, expect, it } from "vitest";

import { getAuthenticatorName } from "./authenticator-names";

describe("getAuthenticatorName", () => {
  it("resolves a known AAGUID to its provider name", () => {
    expect(getAuthenticatorName("ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4")).toBe(
      "Google Password Manager",
    );
    expect(getAuthenticatorName("08987058-cadc-4b81-b6e1-30de50dcbe96")).toBe("Windows Hello");
  });

  it("normalizes casing and surrounding whitespace", () => {
    expect(getAuthenticatorName("  BADA5566-A7AA-401F-BD96-45619A55120D ")).toBe("1Password");
  });

  it("returns undefined for the anonymous all-zero AAGUID", () => {
    expect(getAuthenticatorName("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("returns undefined for empty, nullish, or unknown values", () => {
    expect(getAuthenticatorName(null)).toBeUndefined();
    expect(getAuthenticatorName(undefined)).toBeUndefined();
    expect(getAuthenticatorName("")).toBeUndefined();
    expect(getAuthenticatorName("not-a-real-aaguid")).toBeUndefined();
  });
});
