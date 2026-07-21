import { describe, expect, it } from "vitest";

import { sensorFamilyToDeviceType } from "./device-type-mapping";

describe("sensorFamilyToDeviceType", () => {
  it.each([
    ["multispeq", "multispeq"],
    ["ambit", "ambit"],
    ["minipar", "minipar"],
    ["ambyte", "generic"],
    ["generic", "generic"],
  ] as const)("maps %s to %s", (family, expected) => {
    expect(sensorFamilyToDeviceType(family)).toBe(expected);
  });
});
