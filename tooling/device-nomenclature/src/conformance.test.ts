import { describe, expect, it } from "vitest";

import {
  DEVICE_PROFILES,
  DISPLAY_ROLES,
  resolveDeviceProfile,
  UNKNOWN_DEVICE,
} from "@repo/api/domains/device/device-profile";
import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { sensorFamilyEnum } from "@repo/database/schema";
import { DEVICE_TRANSPORT_SUPPORT, SENSOR_FAMILIES } from "@repo/iot";

import type { ConformanceChannel, HostKey } from "./support-catalog.js";
import { HOST_SUPPORT_CATALOG, SUPPORT_HOSTS } from "./support-catalog.js";

const apiFamilies = [...zSensorFamily.options].toSorted();
const validDeviceTypes = new Set(Object.keys(DEVICE_TRANSPORT_SUPPORT));

/**
 * Derive the precise channels a host may expose for an IoT device type from the
 * IoT driver's capability flags (the single transport authority). Web exposes
 * only BLE-capable Bluetooth (Web Bluetooth is BLE-only); mobile (React Native)
 * exposes Bluetooth Classic and/or BLE plus USB/serial.
 */
function expectedChannels(host: HostKey, deviceType: string): ConformanceChannel[] {
  const support = DEVICE_TRANSPORT_SUPPORT[deviceType as keyof typeof DEVICE_TRANSPORT_SUPPORT];
  const channels: ConformanceChannel[] = [];
  if (host === "mobile" && support.supportsBluetoothClassic) channels.push("bluetooth-classic");
  if (support.supportsBLE) channels.push("ble");
  if (support.supportedTransports.includes("serial")) channels.push("usb-serial");
  return channels;
}

describe("taxonomy conformance", () => {
  // The DB enum is imported from @repo/database/schema, which only pulls
  // drizzle-orm/pg-core definitions and opens no client, so this test is
  // connection-free.
  it("current API and database enum values agree", () => {
    expect([...sensorFamilyEnum.enumValues].toSorted()).toEqual(apiFamilies);
  });

  it("the product profile is exhaustive over API families with canonical spellings", () => {
    expect(Object.keys(DEVICE_PROFILES).toSorted()).toEqual(apiFamilies);
    expect(DEVICE_PROFILES.multispeq.productName).toBe("MultiSpeQ");
    expect(DEVICE_PROFILES.ambit.productName).toBe("Ambit");
    expect(DEVICE_PROFILES.minipar.productName).toBe("MiniPAR");
    expect(DEVICE_PROFILES.ambyte.productName).toBe("Ambyte");
    expect(DEVICE_PROFILES.generic.productName).toBeNull();
    expect(DEVICE_PROFILES.generic.roles).toEqual([]);
    for (const profile of Object.values(DEVICE_PROFILES)) {
      for (const role of profile.roles) expect(DISPLAY_ROLES).toContain(role);
    }
  });

  it("every IoT local family is an API family, without requiring the reverse", () => {
    for (const family of SENSOR_FAMILIES) {
      expect(apiFamilies).toContain(family);
    }
    // ambyte is intentionally an API family with no IoT local identity/driver.
    expect(apiFamilies).toContain("ambyte");
    expect([...SENSOR_FAMILIES]).not.toContain("ambyte");
  });

  it("every real family value resolves to a profile (no surprise miss)", () => {
    for (const family of [...SENSOR_FAMILIES, ...sensorFamilyEnum.enumValues]) {
      expect(resolveDeviceProfile(family)).not.toBeNull();
    }
    expect(resolveDeviceProfile("foreign-value")).toBeNull();
    expect(UNKNOWN_DEVICE).toBe("unknown-device");
  });

  it("every API family has an explicit support classification for each host", () => {
    for (const host of SUPPORT_HOSTS) {
      expect(Object.keys(HOST_SUPPORT_CATALOG[host]).toSorted()).toEqual(apiFamilies);
    }
  });

  it("every current mapping points to a valid IoT device type; unavailable maps to none", () => {
    for (const host of SUPPORT_HOSTS) {
      for (const family of apiFamilies) {
        const support = HOST_SUPPORT_CATALOG[host][family];
        if (support.state === "unavailable") {
          expect(support.deviceType).toBeNull();
          expect(support.transports).toEqual([]);
        } else {
          expect(support.deviceType).not.toBeNull();
          expect(validDeviceTypes.has(support.deviceType as string)).toBe(true);
        }
      }
    }
  });

  it("each host's channel claims match the IoT BLE/Classic/serial capability flags", () => {
    for (const host of SUPPORT_HOSTS) {
      for (const family of apiFamilies) {
        const support = HOST_SUPPORT_CATALOG[host][family];
        if (support.state === "unavailable" || support.deviceType === null) continue;
        expect([...support.transports].toSorted()).toEqual(
          expectedChannels(host, support.deviceType).toSorted(),
        );
      }
    }
  });

  it("keeps Ambit and Ambyte distinct in enums and profiles", () => {
    // Distinctness is a current enum/profile invariant only. Migration 0037
    // remapped then-existing `ambit` rows to `ambyte` before 0038 re-added
    // `ambit`; stored `ambyte` rows may include migrated Ambit data. This suite
    // asserts the schema/profile layer, not historical row provenance.
    expect(sensorFamilyEnum.enumValues).toContain("ambit");
    expect(sensorFamilyEnum.enumValues).toContain("ambyte");
    expect(DEVICE_PROFILES.ambit).not.toEqual(DEVICE_PROFILES.ambyte);
  });

  it("MultiSpeQ is Bluetooth Classic-capable, BLE-incapable, Web Bluetooth-ineligible, serial-capable", () => {
    const support = DEVICE_TRANSPORT_SUPPORT.multispeq;
    expect(support.supportsBluetoothClassic).toBe(true);
    expect(support.supportsBLE).toBe(false); // BLE-only Web Bluetooth is therefore ineligible.
    expect(support.supportedTransports).toContain("serial");
    expect(support.supportedTransports).not.toContain("bluetooth");
  });

  it("records mobile MultiSpeQ as Bluetooth Classic + USB/serial, never BLE", () => {
    const mobileMultispeq = HOST_SUPPORT_CATALOG.mobile.multispeq;
    expect([...mobileMultispeq.transports].toSorted()).toEqual(["bluetooth-classic", "usb-serial"]);
    expect(mobileMultispeq.transports).not.toContain("ble");
  });

  it("records web serial-only vs BLE+serial channels precisely", () => {
    for (const family of ["multispeq", "ambit", "minipar"] as const) {
      expect(HOST_SUPPORT_CATALOG.web[family].transports).toEqual(["usb-serial"]);
    }
    for (const family of ["generic", "ambyte"] as const) {
      expect([...HOST_SUPPORT_CATALOG.web[family].transports].toSorted()).toEqual([
        "ble",
        "usb-serial",
      ]);
    }
  });

  it("models Ambyte as a gateway, mobile-unavailable, web-current-generic, planned BLE only", () => {
    expect(DEVICE_PROFILES.ambyte.roles).toEqual(["gateway"]);

    const webAmbyte = HOST_SUPPORT_CATALOG.web.ambyte;
    expect(webAmbyte.state).toBe("current-generic-compatibility");
    expect(webAmbyte.deviceType).toBe("generic");
    // Planned integration is documented but is not current runtime availability.
    expect(webAmbyte.plannedSpecificIntegration).toBeTruthy();

    expect(HOST_SUPPORT_CATALOG.mobile.ambyte.state).toBe("unavailable");
  });

  it("keeps mobile's current-specific local execution centered on multispeq", () => {
    // The mobile pre-identity/default family fallback constant lives in
    // apps/mobile and is asserted at runtime by ticket 3. At the catalog level,
    // multispeq is mobile's only current-specific family until a separate
    // support initiative changes it.
    expect(HOST_SUPPORT_CATALOG.mobile.multispeq.state).toBe("current-specific");
    expect(HOST_SUPPORT_CATALOG.mobile.multispeq.deviceType).toBe("multispeq");
    const currentSpecificMobile = apiFamilies.filter(
      (family) => HOST_SUPPORT_CATALOG.mobile[family].state === "current-specific",
    );
    expect(currentSpecificMobile).toEqual(["multispeq"]);
  });
});
