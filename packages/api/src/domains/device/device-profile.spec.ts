import { describe, expect, it } from "vitest";

import { zSensorFamily } from "../protocol/protocol.schema";
import {
  DEVICE_PROFILES,
  DISPLAY_ROLES,
  isDisplayRole,
  resolveDeviceProfile,
  UNKNOWN_DEVICE,
} from "./device-profile";

describe("device-profile", () => {
  it("has exactly one profile per API sensor family", () => {
    expect(Object.keys(DEVICE_PROFILES).sort()).toEqual([...zSensorFamily.options].sort());
  });

  it("uses canonical product spellings for known families", () => {
    expect(DEVICE_PROFILES.multispeq.productName).toBe("MultispeQ");
    expect(DEVICE_PROFILES.ambit.productName).toBe("Ambit");
    expect(DEVICE_PROFILES.minipar.productName).toBe("MiniPAR");
    expect(DEVICE_PROFILES.ambyte.productName).toBe("Ambyte");
  });

  it("keeps Ambit and Ambyte distinct products", () => {
    // Enum/profile distinctness is a current schema invariant only. Migration
    // 0037 remapped then-existing `ambit` rows to `ambyte` before 0038 re-added
    // `ambit`, so stored `ambyte` rows may include migrated Ambit data. This
    // module does not repair or reclassify those rows; it presents the family.
    expect(DEVICE_PROFILES.ambit.productName).toBe("Ambit");
    expect(DEVICE_PROFILES.ambyte.productName).toBe("Ambyte");
    expect(DEVICE_PROFILES.ambit).not.toEqual(DEVICE_PROFILES.ambyte);
  });

  it("gives generic no fabricated product name or role", () => {
    expect(DEVICE_PROFILES.generic.productId).toBeNull();
    expect(DEVICE_PROFILES.generic.productName).toBeNull();
    expect(DEVICE_PROFILES.generic.roles).toEqual([]);
  });

  it("models Ambyte's current display role as gateway", () => {
    expect(DEVICE_PROFILES.ambyte.roles).toEqual(["gateway"]);
  });

  it("uses only known display roles", () => {
    for (const profile of Object.values(DEVICE_PROFILES)) {
      for (const role of profile.roles) {
        expect(DISPLAY_ROLES).toContain(role);
      }
    }
  });

  it("resolves known families, including generic, to a profile", () => {
    for (const family of zSensorFamily.options) {
      expect(resolveDeviceProfile(family)).toBe(DEVICE_PROFILES[family]);
    }
  });

  it("resolves unknown or foreign values to null rather than a fabricated profile", () => {
    expect(resolveDeviceProfile("thermometer")).toBeNull();
    expect(resolveDeviceProfile("")).toBeNull();
    expect(resolveDeviceProfile(null)).toBeNull();
    expect(resolveDeviceProfile(undefined)).toBeNull();
    // Object prototype keys must not resolve to a spurious profile.
    expect(resolveDeviceProfile("hasOwnProperty")).toBeNull();
    expect(resolveDeviceProfile("__proto__")).toBeNull();
  });

  it("exposes a stable unknown-device token", () => {
    expect(UNKNOWN_DEVICE).toBe("unknown-device");
  });

  describe("immutability", () => {
    it("freezes the map, each profile, and each nested role array", () => {
      expect(Object.isFrozen(DEVICE_PROFILES)).toBe(true);
      for (const profile of Object.values(DEVICE_PROFILES)) {
        expect(Object.isFrozen(profile)).toBe(true);
        expect(Object.isFrozen(profile.roles)).toBe(true);
      }
    });

    it("rejects mutating canonical profile fields at runtime", () => {
      expect(() => {
        (DEVICE_PROFILES.ambyte as { productName: string | null }).productName = "Hacked";
      }).toThrow(TypeError);
      expect(DEVICE_PROFILES.ambyte.productName).toBe("Ambyte");
    });

    it("rejects pushing into a canonical role array at runtime", () => {
      expect(() => {
        (DEVICE_PROFILES.ambyte.roles as string[]).push("measurement-device");
      }).toThrow(TypeError);
      expect(DEVICE_PROFILES.ambyte.roles).toEqual(["gateway"]);
    });

    it("resolveDeviceProfile returns the frozen canonical object", () => {
      const resolved = resolveDeviceProfile("multispeq");
      expect(resolved).toBe(DEVICE_PROFILES.multispeq);
      expect(Object.isFrozen(resolved)).toBe(true);
    });
  });

  describe("isDisplayRole", () => {
    it("accepts every known display role", () => {
      for (const role of DISPLAY_ROLES) expect(isDisplayRole(role)).toBe(true);
    });

    it("freezes the DISPLAY_ROLES validation authority", () => {
      expect(Object.isFrozen(DISPLAY_ROLES)).toBe(true);
    });

    it("rejects pushing a new token into DISPLAY_ROLES at runtime", () => {
      expect(() => {
        (DISPLAY_ROLES as unknown as string[]).push("runtime-injected-role");
      }).toThrow(TypeError);
      expect([...DISPLAY_ROLES]).toEqual(["measurement-device", "gateway"]);
    });

    it("does not authorize an injected token after a failed push", () => {
      // The push above throws, so the authority is unchanged and the guard keeps
      // rejecting the injected token (presentDevice's rejection is covered in
      // device-presentation.spec.ts).
      expect(isDisplayRole("runtime-injected-role")).toBe(false);
    });

    it("rejects unknown or non-string values", () => {
      expect(isDisplayRole("sensor")).toBe(false);
      expect(isDisplayRole("")).toBe(false);
      expect(isDisplayRole(null)).toBe(false);
      expect(isDisplayRole(undefined)).toBe(false);
      expect(isDisplayRole(42)).toBe(false);
    });
  });
});
