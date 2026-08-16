import { z } from "zod";

import { zResourceCapabilities } from "../authorization/capabilities.schema";
import { zCommandFormat, zExperiment } from "../experiment/experiment.schema";
import { zSensorFamily } from "../protocol/protocol.schema";

// --- Iot Credentials ---
export const zIotCredentials = z.object({
  accessKeyId: z.string().describe("AWS Access Key ID for temporary credentials"),
  secretAccessKey: z.string().describe("AWS Secret Access Key for temporary credentials"),
  sessionToken: z.string().describe("AWS Session Token for temporary credentials"),
  expiration: z.string().datetime().describe("ISO 8601 date string when credentials expire"),
});

export const zIotUploadUrlRequest = z.object({
  experimentId: z.string().uuid().describe("UUID of the experiment to associate this upload with"),
});

export const zIotUploadUrl = z.object({
  uploadUrl: z.string().url().describe("Pre-signed S3 PutObject URL (valid for 15 minutes)"),
  key: z.string().describe("S3 object key where the payload will be stored"),
  expiresAt: z.string().datetime().describe("ISO 8601 date string when the upload URL expires"),
});

// --- IoT IotDevices ---
export const zIotDeviceStatus = z.enum(["pending", "active", "rotating", "revoked"]);

// A device's class shares the canonical sensor-family taxonomy and maps to the ingest topic sensorType.
export const zDeviceType = zSensorFamily;

export const zIotDevice = z.object({
  id: z.string().uuid(),
  thingName: z.string(),
  thingArn: z.string(),
  serialNumber: z.string(),
  name: z.string().nullable(),
  deviceType: zDeviceType,
  status: zIotDeviceStatus,
  certificateId: z.string().nullable(),
  certificateArn: z.string().nullable(),
  createdBy: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  visibility: z.enum(["private", "public"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Broker connectivity from AWS Fleet Indexing. `lastSeenAt` is the timestamp of
 * the last connectivity state change (null when the thing was never indexed as
 * connected). The whole object is null when the index is unavailable or still
 * building; consumers render that as "unknown", never as an error.
 */
export const zDeviceConnectivity = z.object({
  connected: z.boolean(),
  lastSeenAt: z.string().datetime().nullable(),
});

// Only the list and detail routes carry connectivity; register/revoke keep the
// plain shape so their handlers never depend on the fleet index.
export const zIotDeviceWithConnectivity = zIotDevice.extend({
  connectivity: zDeviceConnectivity.nullable(),
});

export const zIotDeviceList = z.array(zIotDeviceWithConnectivity);

/**
 * A single device plus the caller's effective capabilities on it. Only the detail
 * route returns this: capabilities cost one `can()` resolution per resource, so
 * the registry list stays plain `zIotDevice` rather than paying it per row.
 *
 * `canShare`/`canLeave` are what gate the device's Collaborators tab; `canManage`
 * is what the credentials surface and the danger zone hang on, since on a device
 * "manage" means issuing, rotating and revoking real AWS certificates.
 */
export const zIotDeviceDetail = zIotDeviceWithConnectivity.extend({
  capabilities: zResourceCapabilities,
});

export const zRegisterIotDeviceBody = z.object({
  serialNumber: z
    .string()
    .min(1)
    .max(255)
    // AWS IoT thing-attribute values only allow this charset; anything else
    // would fail at CreateThing with an opaque 500.
    .regex(/^[a-zA-Z0-9_.,@/:#=[\]-]+$/, {
      message: "Only letters, numbers, and _ . , @ / : # = [ ] - are allowed",
    })
    .describe("Physical device identifier, e.g. MAC address"),
  name: z.string().min(1).max(255).optional(),
  deviceType: zDeviceType.describe("IotDevice class, maps to the ingest topic sensorType"),
  // Optional target organization to register the device into; defaults to the
  // creator's personal org. The caller must be a member of the given organization.
  organizationId: z.string().uuid().optional(),
});

export const zRegisterIotDeviceResponse = zIotDevice;

// --- Device registry webhook (Databricks lineage: thing_name -> registry) ---
export const zDeviceRegistryWebhookPayload = z.object({
  thingNames: z.array(z.string()).min(1).max(500),
});

export const zDeviceRegistryEntry = z.object({
  thingName: z.string(),
  id: z.string().uuid(),
  serialNumber: z.string(),
  deviceType: zDeviceType,
  status: zIotDeviceStatus,
  createdBy: z.string().uuid(),
});

export const zDeviceRegistryWebhookResponse = z.object({
  devices: z.array(zDeviceRegistryEntry),
  success: z.boolean(),
});

export type DeviceRegistryEntry = z.infer<typeof zDeviceRegistryEntry>;
export type DeviceRegistryWebhookResponse = z.infer<typeof zDeviceRegistryWebhookResponse>;

export const zIotDevicePathParam = z.object({
  deviceId: z.string().uuid().describe("ID of the device"),
});

// Show-once certificate bundle. Returned only at issuance/rotation and never
// persisted or retrievable again.
export const zIssueIotCredentialsResponse = z.object({
  certificateId: z.string(),
  certificateArn: z.string(),
  certificatePem: z.string(),
  publicKey: z.string(),
  privateKey: z.string(),
});

// --- Device onboarding ---
// Onboarding binds a device to experiments and hands the hardware its full
// desired state: broker endpoint plus, per experiment, the ingest topic prefix
// and the pinned workbook version to run.
export const zOnboardDeviceBody = z.object({
  experimentIds: z
    .array(z.string().uuid())
    .max(100)
    .default([])
    .describe("Experiments to bind the device to. An empty list re-issues the config."),
  includeWorkbook: z
    .boolean()
    .default(true)
    .describe("When false, the config carries only the connection and topic contract."),
});

// The device-facing projection of a pinned workbook: only cells a headless
// device can act on, in cell order, with protocol code inlined so the config
// is executable without lookups.
export const zDeviceProcedureProtocol = z.object({
  type: z.literal("protocol"),
  protocolId: z.string().uuid(),
  name: z.string().optional(),
  family: zSensorFamily.optional(),
  code: z.unknown().describe("The protocol's executable code, snapshotted at workbook publish"),
});

export const zDeviceProcedureCommand = z.object({
  type: z.literal("command"),
  format: zCommandFormat,
  content: z.string(),
  name: z.string().optional(),
});

export const zDeviceAnswer = z.union([z.string(), z.array(z.string()), z.null()]);

export const zDeviceProcedureQuestion = z.object({
  type: z.literal("question"),
  id: z.string().describe("Workbook cell id; delivery-time answers key on it"),
  name: z.string().describe("Canonical column key the pipeline uses for this question"),
  kind: z.enum(["yes_no", "open_ended", "multi_choice", "number"]),
  text: z.string(),
  options: z.array(z.string()).optional(),
  required: z.boolean(),
  answer: zDeviceAnswer.describe(
    "Prefilled at delivery; the device attaches it to every measurement",
  ),
});

export const zDeviceProcedure = z.discriminatedUnion("type", [
  zDeviceProcedureProtocol,
  zDeviceProcedureCommand,
  zDeviceProcedureQuestion,
]);

export const zDeviceOnboardingExperiment = z.object({
  experimentId: z.string().uuid(),
  experimentName: z.string(),
  topicPrefix: z
    .string()
    .describe(
      "Ingest topic prefix (experiment/data_ingest/v1/{experimentId}/{sensorType}); the device appends /{sensorVersion}/{sensorId} per measurement.",
    ),
  workbookVersion: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("Pinned workbook version the procedures were compiled from"),
  procedures: z.array(zDeviceProcedure),
});

export const zDeviceOnboardingConfig = z.object({
  thingName: z.string(),
  deviceType: zDeviceType,
  endpoint: z.string().describe("MQTT broker host (AWS IoT ATS data endpoint)"),
  experiments: z.array(zDeviceOnboardingExperiment),
});

// The experiments a device serves, for the device-detail view.
export const zDeviceExperiment = zExperiment
  .pick({ id: true, name: true, status: true })
  .extend({ addedAt: z.string().datetime() });

export const zDeviceExperimentList = z.array(zDeviceExperiment);

/**
 * Last data arrival for a device, computed by the pipeline (gold
 * device_last_activity). Always lags by pipeline cadence; null when the device
 * has never landed data or the warehouse is unavailable.
 */
export const zIotDeviceActivity = z.object({
  lastDataAt: z.string().datetime().nullable(),
});

// --- Device monitoring ---

export const zMonitoringBucket = z.enum(["hour", "day"]);

// The monitoring dashboard's range input: one query window plus its bucket.
export const zMonitoringRangeQuery = z
  .object({
    deviceId: z.string().uuid(),
    from: z.string().datetime(),
    to: z.string().datetime(),
    bucket: zMonitoringBucket,
  })
  .refine((range) => new Date(range.from).getTime() < new Date(range.to).getTime(), {
    message: "from must be before to",
    path: ["from"],
  })
  // The UI presets top out at 30 days; an unbounded span would let one request
  // scan and return an arbitrarily large slice of the warehouse.
  .refine(
    (range) => new Date(range.to).getTime() - new Date(range.from).getTime() <= 31 * 86_400_000,
    { message: "range must not exceed 31 days", path: ["to"] },
  );

export const zDeviceLifecycleEvent = z.object({
  eventType: z.enum(["connected", "disconnected"]),
  eventTimestamp: z.string().datetime(),
  disconnectReason: z.string().nullable(),
  sessionIdentifier: z.string().nullable(),
});

/**
 * A connectivity session derived from paired lifecycle events, clamped to the
 * queried range. `openStart` marks a session already running at range start;
 * a null `end` marks one still running at range end.
 */
export const zDeviceSession = z.object({
  start: z.string().datetime(),
  end: z.string().datetime().nullable(),
  openStart: z.boolean(),
  durationSeconds: z.number(),
  disconnectReason: z.string().nullable(),
});

export const zDeviceThroughputBucket = z.object({
  bucketStart: z.string().datetime(),
  experimentId: z.string().uuid().nullable(),
  count: z.number().int(),
});

export const zDeviceBatteryPoint = z.object({
  bucketStart: z.string().datetime(),
  averageBattery: z.number().nullable(),
});

/**
 * Payload-content profile of the measurements a device sent in a range:
 * coverage of the optional metadata channels, firmware mix, protocol mix, and
 * workbook-run counts. Protocol attribution only exists on legacy-topic rows.
 */
export const zDevicePayloadStats = z.object({
  totalMeasurements: z.number().int(),
  withGps: z.number().int(),
  withBattery: z.number().int(),
  workbookRuns: z.number().int(),
  firmwareMix: z.array(z.object({ version: z.string().nullable(), count: z.number().int() })),
  protocolMix: z.array(z.object({ protocolId: z.string().nullable(), count: z.number().int() })),
  workbookMix: z.array(
    z.object({ workbookVersionId: z.string().nullable(), count: z.number().int() }),
  ),
  /**
   * Measurements per macro. A measurement can run several macros, so these
   * counts are per macro run and do not sum to `totalMeasurements`.
   */
  macroMix: z.array(z.object({ macroId: z.string().nullable(), count: z.number().int() })),
});

/** A firmware version the device reported, and the window it was seen in. */
export const zDeviceFirmwareVersion = z.object({
  version: z.string().nullable(),
  firstSeen: z.string().datetime(),
  lastSeen: z.string().datetime(),
  count: z.number().int(),
});

/** One stored measurement, for the row-level table behind the aggregates. */
export const zDeviceMeasurement = z.object({
  timestamp: z.string().datetime(),
  experimentId: z.string().nullable(),
  protocolId: z.string().nullable(),
  workbookVersionId: z.string().nullable(),
  deviceVersion: z.string().nullable(),
  battery: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /** The reading itself, as stored JSON; its shape is device-defined. */
  sample: z.string().nullable(),
});

/**
 * Everything the monitoring dashboard needs for one range, in one response:
 * the warehouse queries run in parallel server-side.
 */
export const zDeviceMonitoring = z.object({
  bucket: zMonitoringBucket,
  events: z.array(zDeviceLifecycleEvent),
  sessions: z.array(zDeviceSession),
  uptimePercent: z.number().nullable(),
  // True when the range held more events than the query cap; sessions and
  // uptime then cover only the returned window.
  truncated: z.boolean(),
  throughput: z.array(zDeviceThroughputBucket),
  battery: z.array(zDeviceBatteryPoint),
  payload: zDevicePayloadStats,
  firmwareHistory: z.array(zDeviceFirmwareVersion),
  recentMeasurements: z.array(zDeviceMeasurement),
});

// --- Inferred types ---
export type OnboardDeviceBody = z.infer<typeof zOnboardDeviceBody>;
export type DeviceProcedure = z.infer<typeof zDeviceProcedure>;
export type DeviceAnswer = z.infer<typeof zDeviceAnswer>;
export type DeviceOnboardingExperiment = z.infer<typeof zDeviceOnboardingExperiment>;
export type DeviceOnboardingConfig = z.infer<typeof zDeviceOnboardingConfig>;
export type DeviceExperiment = z.infer<typeof zDeviceExperiment>;
export type DeviceExperimentList = z.infer<typeof zDeviceExperimentList>;
export type IotCredentials = z.infer<typeof zIotCredentials>;
export type IotUploadUrlRequest = z.infer<typeof zIotUploadUrlRequest>;
export type IotUploadUrl = z.infer<typeof zIotUploadUrl>;
export type IotDeviceStatus = z.infer<typeof zIotDeviceStatus>;
export type IotDevice = z.infer<typeof zIotDevice>;
export type DeviceConnectivity = z.infer<typeof zDeviceConnectivity>;
export type MonitoringBucket = z.infer<typeof zMonitoringBucket>;
export type DeviceLifecycleEvent = z.infer<typeof zDeviceLifecycleEvent>;
export type DeviceSession = z.infer<typeof zDeviceSession>;
export type DeviceThroughputBucket = z.infer<typeof zDeviceThroughputBucket>;
export type DeviceBatteryPoint = z.infer<typeof zDeviceBatteryPoint>;
export type DevicePayloadStats = z.infer<typeof zDevicePayloadStats>;
export type DeviceFirmwareVersion = z.infer<typeof zDeviceFirmwareVersion>;
export type DeviceMeasurement = z.infer<typeof zDeviceMeasurement>;
export type DeviceMonitoring = z.infer<typeof zDeviceMonitoring>;
export type IotDeviceWithConnectivity = z.infer<typeof zIotDeviceWithConnectivity>;
export type IotDeviceActivity = z.infer<typeof zIotDeviceActivity>;
export type IotDeviceDetail = z.infer<typeof zIotDeviceDetail>;
export type IotDeviceList = z.infer<typeof zIotDeviceList>;
export type RegisterIotDeviceBody = z.infer<typeof zRegisterIotDeviceBody>;
export type IotDevicePathParam = z.infer<typeof zIotDevicePathParam>;
export type IssueIotCredentialsResponse = z.infer<typeof zIssueIotCredentialsResponse>;
