import { describe, expect, it } from "vitest";

import type { DisplayRole } from "../domains/device/device-profile";
import { DEVICE_PROFILES, DISPLAY_ROLES, UNKNOWN_DEVICE } from "../domains/device/device-profile";
import { presentDevice } from "./device-presentation";

describe("device-presentation", () => {
  describe("primary value hierarchy", () => {
    it("uses a usable assigned/reported name first", () => {
      const result = presentDevice({ name: "Greenhouse A", family: "multispeq", id: "sn-1" });
      expect(result.primary).toBe("Greenhouse A");
      expect(result.provenance).toBe("name");
      // Product context is still available as secondary data alongside the name.
      expect(result.productName).toBe("MultispeQ");
      expect(result.productId).toBe("multispeq");
      expect(result.id).toBe("sn-1");
    });

    it("falls back to the canonical product name when there is no usable name", () => {
      const result = presentDevice({ family: "ambit", id: "sn-2" });
      expect(result.primary).toBe("Ambit");
      expect(result.provenance).toBe("product");
      expect(result.productName).toBe("Ambit");
      expect(result.productId).toBe("ambit");
      expect(result.id).toBe("sn-2");
    });

    it("treats a blank or whitespace name as unusable", () => {
      const result = presentDevice({ name: "   ", family: "minipar" });
      expect(result.primary).toBe("MiniPAR");
      expect(result.provenance).toBe("product");
    });

    it("trims a usable name", () => {
      const result = presentDevice({ name: "  Bench 3  " });
      expect(result.primary).toBe("Bench 3");
      expect(result.provenance).toBe("name");
    });
  });

  describe("unknown-device fallback", () => {
    it("returns the unknown-device token for an unknown/foreign family with no name", () => {
      const result = presentDevice({ family: "thermometer", id: "sn-3" });
      expect(result.primary).toBe(UNKNOWN_DEVICE);
      expect(result.provenance).toBe("fallback");
      expect(result.productName).toBeNull();
      expect(result.productId).toBeNull();
      expect(result.id).toBe("sn-3");
    });

    it("returns the unknown-device token for the generic family with no name", () => {
      const result = presentDevice({ family: "generic", id: "sn-4" });
      expect(result.primary).toBe(UNKNOWN_DEVICE);
      expect(result.provenance).toBe("fallback");
      expect(result.productName).toBeNull();
    });

    it("returns the unknown-device token with a null id when nothing is provided", () => {
      const result = presentDevice({});
      expect(result.primary).toBe(UNKNOWN_DEVICE);
      expect(result.provenance).toBe("fallback");
      expect(result.id).toBeNull();
      expect(result.roles).toEqual([]);
    });

    it("still shows a name for an unknown family", () => {
      const result = presentDevice({ name: "Field probe", family: "thermometer" });
      expect(result.primary).toBe("Field probe");
      expect(result.provenance).toBe("name");
      expect(result.productName).toBeNull();
    });
  });

  describe("identifier-only data", () => {
    it("keeps the stable identifier as secondary/fallback context", () => {
      const result = presentDevice({ id: "AA:BB:CC" });
      expect(result.primary).toBe(UNKNOWN_DEVICE);
      expect(result.id).toBe("AA:BB:CC");
    });

    it("drops a blank identifier to null", () => {
      expect(presentDevice({ family: "ambit", id: "  " }).id).toBeNull();
    });
  });

  describe("roles", () => {
    it("uses the profile's default role when no contextual role is supplied", () => {
      expect(presentDevice({ family: "ambyte" }).roles).toEqual(["gateway"]);
      expect(presentDevice({ family: "multispeq" }).roles).toEqual(["measurement-device"]);
    });

    it("lets the host override with explicit contextual roles", () => {
      const result = presentDevice({ family: "ambyte", roles: ["measurement-device"] });
      expect(result.roles).toEqual(["measurement-device"]);
    });

    it("dedupes and trims explicit roles", () => {
      // Untyped runtime input with surrounding whitespace and a blank token.
      const result = presentDevice({
        roles: [" gateway ", "gateway", ""] as unknown as DisplayRole[],
      });
      expect(result.roles).toEqual(["gateway"]);
    });

    it("has no roles for generic without a contextual override", () => {
      expect(presentDevice({ family: "generic" }).roles).toEqual([]);
    });

    it("drops arbitrary runtime role strings that are not known display roles", () => {
      // Simulate an untyped JS caller passing unknown tokens.
      const result = presentDevice({
        roles: ["not-a-known-role", "gateway", "sensor"] as unknown as DisplayRole[],
      });
      expect(result.roles).toEqual(["gateway"]);
    });

    it("falls back to profile defaults when every supplied role is invalid", () => {
      const result = presentDevice({
        family: "ambyte",
        roles: ["bogus"] as unknown as DisplayRole[],
      });
      // All supplied tokens are invalid, so the (empty) filtered override yields
      // to the profile's default role rather than escaping the invalid token.
      expect(result.roles).toEqual(["gateway"]);
    });

    it("returns no roles when the filtered override is empty and no profile applies", () => {
      const result = presentDevice({ roles: ["bogus"] as unknown as DisplayRole[] });
      expect(result.roles).toEqual([]);
    });

    it("cannot emit a token pushed into the frozen role authority", () => {
      // A JS caller cannot mutate the validation authority: the push throws and
      // presentDevice keeps rejecting the injected token.
      expect(() => {
        (DISPLAY_ROLES as unknown as string[]).push("runtime-injected-role");
      }).toThrow(TypeError);
      const result = presentDevice({
        roles: ["runtime-injected-role"] as unknown as DisplayRole[],
      });
      expect(result.roles).not.toContain("runtime-injected-role");
      expect(result.roles).toEqual([]);
    });
  });

  describe("immutability and isolation", () => {
    it("returns a frozen roles collection", () => {
      const result = presentDevice({ family: "ambyte" });
      expect(Object.isFrozen(result.roles)).toBe(true);
      expect(() => {
        (result.roles as string[]).push("measurement-device");
      }).toThrow(TypeError);
    });

    it("returns a defensive copy, not the canonical profile array", () => {
      const result = presentDevice({ family: "ambyte" });
      expect(result.roles).toEqual(["gateway"]);
      expect(result.roles).not.toBe(DEVICE_PROFILES.ambyte.roles);
    });

    it("isolates roles between calls", () => {
      const first = presentDevice({ family: "multispeq" });
      const second = presentDevice({ family: "multispeq" });
      expect(first.roles).not.toBe(second.roles);
      expect(second.roles).toEqual(["measurement-device"]);
      // Canonical defaults are untouched by any prior call.
      expect(DEVICE_PROFILES.multispeq.roles).toEqual(["measurement-device"]);
    });
  });

  describe("missing optional metadata", () => {
    it("omits product and id without substituting a product name", () => {
      const result = presentDevice({ name: "Unit 7" });
      expect(result.primary).toBe("Unit 7");
      expect(result.productName).toBeNull();
      expect(result.productId).toBeNull();
      expect(result.id).toBeNull();
      expect(result.roles).toEqual([]);
    });
  });
});
