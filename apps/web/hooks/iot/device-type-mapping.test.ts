import { describe, expect, it } from "vitest";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { DeviceType } from "@repo/iot";

import { sensorFamilyToDeviceType } from "./device-type-mapping";

/**
 * Host-owned expectation: the IoT `DeviceType` the web host routes each API
 * sensor family to. Every family maps to its own device type; `ambyte` has no
 * dedicated driver and is routed through the generic one at connection time.
 */
const EXPECTED_DEVICE_TYPE: Record<SensorFamily, DeviceType> = {
  multispeq: "multispeq",
  ambit: "ambit",
  minipar: "minipar",
  generic: "generic",
  ambyte: "ambyte",
};

describe("sensorFamilyToDeviceType", () => {
  it.each(Object.entries(EXPECTED_DEVICE_TYPE))(
    "maps %s to the %s driver",
    (family, deviceType) => {
      expect(sensorFamilyToDeviceType(family as SensorFamily)).toBe(deviceType);
    },
  );

  it("pins a device type for every current API sensor family", () => {
    expect(Object.keys(EXPECTED_DEVICE_TYPE).toSorted()).toEqual(
      [...zSensorFamily.options].toSorted(),
    );
  });
});
