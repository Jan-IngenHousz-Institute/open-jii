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

// --- Inferred types ---
export type IotCredentials = z.infer<typeof zIotCredentials>;
export type IotUploadUrlRequest = z.infer<typeof zIotUploadUrlRequest>;
export type IotUploadUrl = z.infer<typeof zIotUploadUrl>;
