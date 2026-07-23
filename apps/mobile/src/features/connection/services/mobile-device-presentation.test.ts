import { describe, expect, it } from "vitest";
import type { Device } from "~/shared/types/device";

import type { DeviceIdentity } from "@repo/iot";

import {
  mobileDeviceAttributedLabel,
  mobileDevicePrimaryLabel,
  mobileDeviceSecondaryParts,
  presentMobileDevice,
} from "./mobile-device-presentation";

const device: Device = {
  type: "bluetooth-classic",
  id: "AA:BB:CC:DD:EE:FF",
  name: "AA:BB:CC:DD:EE:FF",
};

function identity(patch: Partial<DeviceIdentity>): DeviceIdentity {
  return { family: "multispeq", raw: {}, ...patch };
}

const labels = {
  measurementDevice: "Measurement device",
  identifier: (id: string) => `ID ${id}`,
};

describe("presentMobileDevice", () => {
  it("uses the device-reported name first and retains product, role, and id context", () => {
    const presentation = presentMobileDevice(
      { ...device, name: "Transport name" },
      identity({ name: "Plot probe", deviceId: "SN-42" }),
    );

    expect(presentation).toMatchObject({
      primary: "Plot probe",
      provenance: "name",
      productName: "MultiSpeQ",
      id: "SN-42",
    });
    expect(mobileDeviceSecondaryParts(presentation, labels)).toEqual([
      "MultiSpeQ",
      "Measurement device",
      "ID SN-42",
    ]);
  });

  it("uses the canonical product when identity has no usable name", () => {
    const presentation = presentMobileDevice(device, identity({}));

    expect(presentation).toMatchObject({ primary: "MultiSpeQ", provenance: "product" });
    expect(mobileDeviceSecondaryParts(presentation, labels)).toEqual([
      "Measurement device",
      "ID AA:BB:CC:DD:EE:FF",
    ]);
  });

  it("does not fabricate MultiSpeQ while identity is unavailable or failed", () => {
    const presentation = presentMobileDevice(device);

    expect(presentation).toMatchObject({
      primary: "unknown-device",
      provenance: "fallback",
      productName: null,
      id: "AA:BB:CC:DD:EE:FF",
    });
    expect(mobileDevicePrimaryLabel(presentation, "Unknown device")).toBe("Unknown device");
  });

  it("keeps a usable transport name during the pre-identity fallback", () => {
    const presentation = presentMobileDevice({ ...device, name: "Field unit" });

    expect(presentation).toMatchObject({
      primary: "Field unit",
      provenance: "name",
      productName: null,
    });
  });

  it("keeps action labels concise for a named identity", () => {
    const presentation = presentMobileDevice(
      device,
      identity({ name: "Plot probe", deviceId: "SN-42" }),
    );

    expect(
      mobileDeviceAttributedLabel(presentation, {
        unknownDevice: "Unknown device",
        identifier: labels.identifier,
      }),
    ).toBe("Plot probe");
  });

  it("adds stable identifier context to a product fallback", () => {
    const presentation = presentMobileDevice(device, identity({ deviceId: "SN-42" }));

    expect(
      mobileDeviceAttributedLabel(presentation, {
        unknownDevice: "Unknown device",
        identifier: labels.identifier,
      }),
    ).toBe("MultiSpeQ (ID SN-42)");
  });

  it("adds stable identifier context to an unknown fallback", () => {
    const presentation = presentMobileDevice(device);

    expect(
      mobileDeviceAttributedLabel(presentation, {
        unknownDevice: "Unknown device",
        identifier: labels.identifier,
      }),
    ).toBe("Unknown device (ID AA:BB:CC:DD:EE:FF)");
  });
});
