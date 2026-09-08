import { orpc } from "@/lib/orpc";
import { describe, expect, it } from "vitest";

import { allResourceCacheFamilies, resourceCacheKeys } from "./resource-cache-keys";

describe("resource cache keys", () => {
  describe("resourceCacheKeys", () => {
    it("names the device's own detail and the device list", () => {
      const keys = resourceCacheKeys("device", "dev-1");

      expect(keys).toContainEqual(orpc.iot.getIotDevice.queryKey({ input: { deviceId: "dev-1" } }));
      expect(keys).toContainEqual(orpc.iot.listIotDevices.key());
    });

    it("names the calibration definition's own detail and the definition list", () => {
      const keys = resourceCacheKeys("calibration_definition", "def-1");

      expect(keys).toContainEqual(
        orpc.iot.getCalibrationDefinition.queryKey({ input: { definitionId: "def-1" } }),
      );
      expect(keys).toContainEqual(orpc.iot.listCalibrationDefinitions.key());
    });

    it("does not refresh a peer resource's caches", () => {
      const keys = resourceCacheKeys("calibration_definition", "def-1");

      expect(keys).not.toContainEqual(orpc.iot.listIotDevices.key());
    });
  });

  describe("allResourceCacheFamilies", () => {
    it("covers every shareable type's detail cache", () => {
      const families = allResourceCacheFamilies();

      expect(families).toContainEqual(orpc.iot.getCalibrationDefinition.key());
      expect(families).toContainEqual(orpc.iot.getIotDeviceGroup.key());
      expect(families).toContainEqual(orpc.experiments.getExperiment.key());
    });
  });
});
