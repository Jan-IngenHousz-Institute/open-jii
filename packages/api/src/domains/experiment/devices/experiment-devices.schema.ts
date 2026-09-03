import { z } from "zod";

import { zDeviceConnectivity, zIotDevice } from "../../iot/iot.schema";

// The registry identity of a device on the tab. Certificate and governance
// fields are deliberately omitted: experiment members see the devices serving
// their experiment, not the credential or org state of hardware they may not own.
export const zExperimentDeviceIdentity = zIotDevice.pick({
  id: true,
  thingName: true,
  serialNumber: true,
  name: true,
  deviceType: true,
  status: true,
});

export const zExperimentDeviceBinding = z.object({
  addedBy: z.string().uuid(),
  addedAt: z.string().datetime(),
});

// Measurements this device published into this experiment inside the window.
export const zExperimentDeviceRecentData = z.object({
  measurementCount: z.number().int().nonnegative(),
  lastDataAt: z.string().datetime().nullable(),
});

/**
 * One device relevant to an experiment: bound to it, observed publishing into
 * it, or both. `device` is null for a publisher whose client id matches no
 * registry row. `lastDataAt` is device-wide; `recentData` is scoped to this
 * experiment and the window, and null when nothing landed or the warehouse
 * was unavailable. `canView` says whether the caller may open the device page.
 */
export const zExperimentDeviceEntry = z.object({
  device: zExperimentDeviceIdentity.nullable(),
  clientId: z.string(),
  binding: zExperimentDeviceBinding.nullable(),
  connectivity: zDeviceConnectivity.nullable(),
  lastDataAt: z.string().datetime().nullable(),
  recentData: zExperimentDeviceRecentData.nullable(),
  canView: z.boolean(),
});

export const zExperimentDevicesOverview = z.object({
  devices: z.array(zExperimentDeviceEntry),
  window: z.object({ from: z.string().datetime(), to: z.string().datetime() }),
  pipelineUnavailable: z.boolean(),
});

export const zExperimentDevicePathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  deviceId: z.string().uuid().describe("ID of the device"),
});

export type ExperimentDeviceIdentity = z.infer<typeof zExperimentDeviceIdentity>;
export type ExperimentDeviceEntry = z.infer<typeof zExperimentDeviceEntry>;
export type ExperimentDevicesOverview = z.infer<typeof zExperimentDevicesOverview>;
export type ExperimentDevicePathParam = z.infer<typeof zExperimentDevicePathParam>;
