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
 * What the device said about itself while publishing into this experiment,
 * folded from the pipeline's per-firmware rows: the newest firmware, version,
 * battery and self-reported name, plus its total measurements in the
 * experiment. Null when the pipeline knows nothing about it.
 */
export const zExperimentDeviceReported = z.object({
  deviceName: z.string().nullable(),
  firmware: z.string().nullable(),
  version: z.string().nullable(),
  battery: z.number().nullable(),
  totalMeasurements: z.number().int().nonnegative(),
  lastReportedAt: z.string().datetime().nullable(),
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
  reported: zExperimentDeviceReported.nullable(),
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

/**
 * One device's measurement volume inside one experiment. Keyed by client id,
 * not device id: the tab lists publishers with no registry row, and those have
 * no UUID to address. The client id travels as a query parameter because it can
 * carry colons.
 */
export const zExperimentDeviceSeriesQuery = z
  .object({
    id: z.string().uuid().describe("ID of the experiment"),
    clientId: z.string().min(1).describe("Broker client id of the publishing device"),
    from: z.string().datetime(),
    to: z.string().datetime(),
    bucket: z.enum(["hour", "day"]),
  })
  .refine((range) => new Date(range.from).getTime() < new Date(range.to).getTime(), {
    message: "from must be before to",
    path: ["from"],
  })
  .refine(
    (range) => new Date(range.to).getTime() - new Date(range.from).getTime() <= 31 * 86_400_000,
    { message: "range must not exceed 31 days", path: ["to"] },
  );

export const zExperimentDeviceSeriesBucket = z.object({
  bucketStart: z.string().datetime().nullable(),
  count: z.number().int().nonnegative(),
});

export const zExperimentDeviceSeries = z.object({
  buckets: z.array(zExperimentDeviceSeriesBucket),
  /** True when the warehouse could not be reached; the series is empty, not zero. */
  pipelineUnavailable: z.boolean(),
});

export type ExperimentDeviceIdentity = z.infer<typeof zExperimentDeviceIdentity>;
export type ExperimentDeviceSeries = z.infer<typeof zExperimentDeviceSeries>;
export type ExperimentDeviceSeriesBucket = z.infer<typeof zExperimentDeviceSeriesBucket>;
export type ExperimentDeviceReported = z.infer<typeof zExperimentDeviceReported>;
export type ExperimentDeviceEntry = z.infer<typeof zExperimentDeviceEntry>;
export type ExperimentDevicesOverview = z.infer<typeof zExperimentDevicesOverview>;
export type ExperimentDevicePathParam = z.infer<typeof zExperimentDevicePathParam>;
