import { describe, it, expect } from "vitest";

import { DYNAMIC_COMMAND_REF_CAPABILITY, hasCapability, parseCapabilities } from "./capabilities";

describe("parseCapabilities", () => {
  it("returns an empty set for missing values", () => {
    expect(parseCapabilities(undefined).size).toBe(0);
    expect(parseCapabilities(null).size).toBe(0);
    expect(parseCapabilities("").size).toBe(0);
  });

  it("splits on commas and whitespace and trims tokens", () => {
    const set = parseCapabilities("dynamic-command-ref-v1,  other cap-three");
    expect(set.has("dynamic-command-ref-v1")).toBe(true);
    expect(set.has("other")).toBe(true);
    expect(set.has("cap-three")).toBe(true);
  });

  it("joins an array header value", () => {
    expect(parseCapabilities([DYNAMIC_COMMAND_REF_CAPABILITY, "x"]).has("x")).toBe(true);
  });
});

describe("hasCapability", () => {
  it("is true only when the token is present", () => {
    expect(hasCapability(DYNAMIC_COMMAND_REF_CAPABILITY, DYNAMIC_COMMAND_REF_CAPABILITY)).toBe(
      true,
    );
    expect(hasCapability("something-else", DYNAMIC_COMMAND_REF_CAPABILITY)).toBe(false);
    expect(hasCapability(undefined, DYNAMIC_COMMAND_REF_CAPABILITY)).toBe(false);
  });
});
