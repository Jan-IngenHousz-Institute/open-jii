import { z } from "zod";

import { zExperiment } from "./experiment.schema";
import { zSensorFamily } from "./protocol.schema";
import { zWorkbookVersion } from "./workbook-version.schema";

// --- Iot Credentials ---
export const zIotCredentials = z.object({
  accessKeyId: z.string().describe("AWS Access Key ID for temporary credentials"),
  secretAccessKey: z.string().describe("AWS Secret Access Key for temporary credentials"),
  sessionToken: z.string().describe("AWS Session Token for temporary credentials"),
  expiration: z.string().datetime().describe("ISO 8601 date string when credentials expire"),
});

// --- IoT Upload URL ---
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zIotDeviceList = z.array(zIotDevice);

export const zRegisterIotDeviceBody = z.object({
  serialNumber: z.string().min(1).max(255).describe("Physical device identifier, e.g. MAC address"),
  name: z.string().min(1).max(255).optional(),
  deviceType: zDeviceType.describe("IotDevice class, maps to the ingest topic sensorType"),
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

// --- Experiment <-> Device binding ---
export const zExperimentDevice = z.object({
  // Derived from the canonical device schema. Certificate fields are omitted:
  // experiment members see the devices bound to their experiment, not the
  // credential state of hardware they may not own.
  device: zIotDevice.pick({
    id: true,
    thingName: true,
    serialNumber: true,
    name: true,
    deviceType: true,
    status: true,
  }),
  addedBy: z.string().uuid(),
  addedAt: z.string().datetime(),
});

export const zExperimentDeviceList = z.array(zExperimentDevice);

// The experiments a device serves, for the device-detail view.
export const zDeviceExperiment = zExperiment
  .pick({ id: true, name: true, status: true })
  .extend({ addedAt: z.string().datetime() });

export const zDeviceExperimentList = z.array(zDeviceExperiment);

// --- Device onboarding ---
// Onboarding binds the device to experiments and returns everything the
// hardware must be told: the broker endpoint and, per bound experiment, the
// ingest topic prefix plus the pinned workbook version (the procedure to run).
export const zOnboardDeviceBody = z.object({
  experimentIds: z
    .array(z.string().uuid())
    .max(100)
    .default([])
    .describe("Experiments to bind before returning the config; empty re-issues the config"),
});

export const zDeviceOnboardingWorkbook = zWorkbookVersion.pick({
  version: true,
  cells: true,
  entitySnapshots: true,
});

export const zDeviceOnboardingExperiment = z.object({
  experimentId: z.string().uuid(),
  experimentName: z.string(),
  topicPrefix: z
    .string()
    .describe(
      "experiment/data_ingest/v1/{experimentId}/{sensorType}; the device appends /{sensorVersion}/{sensorId}/{protocolId}",
    ),
  workbook: zDeviceOnboardingWorkbook
    .nullable()
    .describe("Pinned workbook version to run, or null if the experiment has none"),
});

export const zDeviceOnboardingConfig = z.object({
  thingName: z.string(),
  deviceType: zDeviceType,
  endpoint: z.string().describe("MQTT broker host (AWS IoT ATS data endpoint)"),
  experiments: z.array(zDeviceOnboardingExperiment),
});

// --- Inferred types ---
export type ExperimentDevice = z.infer<typeof zExperimentDevice>;
export type ExperimentDeviceList = z.infer<typeof zExperimentDeviceList>;
export type DeviceExperiment = z.infer<typeof zDeviceExperiment>;
export type DeviceExperimentList = z.infer<typeof zDeviceExperimentList>;
export type OnboardDeviceBody = z.infer<typeof zOnboardDeviceBody>;
export type DeviceOnboardingExperiment = z.infer<typeof zDeviceOnboardingExperiment>;
export type DeviceOnboardingConfig = z.infer<typeof zDeviceOnboardingConfig>;
export type IotCredentials = z.infer<typeof zIotCredentials>;
export type IotUploadUrlRequest = z.infer<typeof zIotUploadUrlRequest>;
export type IotUploadUrl = z.infer<typeof zIotUploadUrl>;
export type IotDeviceStatus = z.infer<typeof zIotDeviceStatus>;
export type IotDevice = z.infer<typeof zIotDevice>;
export type IotDeviceList = z.infer<typeof zIotDeviceList>;
export type RegisterIotDeviceBody = z.infer<typeof zRegisterIotDeviceBody>;
export type IotDevicePathParam = z.infer<typeof zIotDevicePathParam>;
export type IssueIotCredentialsResponse = z.infer<typeof zIssueIotCredentialsResponse>;
