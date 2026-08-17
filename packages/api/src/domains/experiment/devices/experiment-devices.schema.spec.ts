import { describe, expect, it } from "vitest";

import {
  zExperimentDevice,
  zExperimentDevicePathParam,
  zExperimentDeviceList,
} from "./experiment-devices.schema";

const validDevice = {
  device: {
    id: "11111111-1111-4111-8111-111111111111",
    thingName: "ambyte_AA11",
    serialNumber: "AA:11",
    name: "Bench sensor",
    deviceType: "ambyte",
    status: "active",
  },
  addedBy: "22222222-2222-4222-8222-222222222222",
  addedAt: "2026-01-01T00:00:00.000Z",
};

describe("zExperimentDevice", () => {
  it("accepts a bound device with a nullable name", () => {
    expect(zExperimentDevice.safeParse(validDevice).success).toBe(true);
    expect(
      zExperimentDevice.safeParse({
        ...validDevice,
        device: { ...validDevice.device, name: null },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown device type or status", () => {
    expect(
      zExperimentDevice.safeParse({
        ...validDevice,
        device: { ...validDevice.device, deviceType: "toaster" },
      }).success,
    ).toBe(false);
    expect(
      zExperimentDevice.safeParse({
        ...validDevice,
        device: { ...validDevice.device, status: "on-fire" },
      }).success,
    ).toBe(false);
  });

  it("rejects a non-datetime addedAt", () => {
    expect(zExperimentDevice.safeParse({ ...validDevice, addedAt: "yesterday" }).success).toBe(
      false,
    );
  });
});

describe("zExperimentDeviceList", () => {
  it("accepts an empty list", () => {
    expect(zExperimentDeviceList.safeParse([]).success).toBe(true);
  });
});

describe("zExperimentDevicePathParam", () => {
  it("requires both ids to be uuids", () => {
    expect(
      zExperimentDevicePathParam.safeParse({
        id: "11111111-1111-4111-8111-111111111111",
        deviceId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    expect(
      zExperimentDevicePathParam.safeParse({ id: "not-a-uuid", deviceId: "also-not" }).success,
    ).toBe(false);
  });
});
