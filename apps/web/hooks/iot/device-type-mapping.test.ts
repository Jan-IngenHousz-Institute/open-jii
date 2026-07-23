import { describe, expect, it } from "vitest";

import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { HOST_SUPPORT_CATALOG } from "@repo/device-nomenclature";

import { sensorFamilyToDeviceType } from "./device-type-mapping";

describe("sensorFamilyToDeviceType", () => {
  it.each(zSensorFamily.options)(
    "maps %s directly to the approved web support catalog",
    (family) => {
      expect(sensorFamilyToDeviceType(family)).toBe(HOST_SUPPORT_CATALOG.web[family].deviceType);
    },
  );

  it("the catalog covers every API sensor family", () => {
    expect(Object.keys(HOST_SUPPORT_CATALOG.web).toSorted()).toEqual(
      [...zSensorFamily.options].toSorted(),
    );
  });
});
