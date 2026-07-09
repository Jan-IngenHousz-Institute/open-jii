import { z } from "zod";

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
export const zIotDeviceStatus = z.enum(["pending", "active", "revoked"]);

export const zIotDevice = z.object({
  id: z.string().uuid(),
  thingName: z.string(),
  thingArn: z.string(),
  serialNumber: z.string(),
  name: z.string().nullable(),
  deviceType: z.string(),
  status: zIotDeviceStatus,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zIotDeviceList = z.array(zIotDevice);

export const zRegisterIotDeviceBody = z.object({
  serialNumber: z.string().min(1).max(255).describe("Physical device identifier, e.g. MAC address"),
  name: z.string().min(1).max(255).optional(),
  deviceType: z.string().min(1).max(255).describe("IotDevice class, maps to the ingest topic sensorType"),
});

export const zRegisterIotDeviceResponse = zIotDevice;

export const zIotDevicePathParam = z.object({
  deviceId: z.string().uuid().describe("ID of the device"),
});

// --- Inferred types ---
export type IotCredentials = z.infer<typeof zIotCredentials>;
export type IotUploadUrlRequest = z.infer<typeof zIotUploadUrlRequest>;
export type IotUploadUrl = z.infer<typeof zIotUploadUrl>;
export type IotDeviceStatus = z.infer<typeof zIotDeviceStatus>;
export type IotDevice = z.infer<typeof zIotDevice>;
export type IotDeviceList = z.infer<typeof zIotDeviceList>;
export type RegisterIotDeviceBody = z.infer<typeof zRegisterIotDeviceBody>;
export type IotDevicePathParam = z.infer<typeof zIotDevicePathParam>;
