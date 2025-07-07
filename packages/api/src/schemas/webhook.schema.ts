import { z } from "zod";

// Auth header schema for webhook authentication
export const zWebhookAuthHeader = z.object({
  "x-api-key-id": z.string(),
  "x-databricks-signature": z.string(),
  "x-databricks-timestamp": z.string(),
});

// Schema for Databricks webhook payload
export const zDatabricksWebhookPayload = z.object({
  experimentId: z.string().uuid(),
  status: z.enum([
    // Terminal statuses
    "SUCCESS",
    "FAILURE",
    "CANCELED",
    "TIMEOUT",
    "FAILED",
    // Non-terminal statuses
    "RUNNING",
    "PENDING",
    "SKIPPED",
    "DEPLOYING",
    "DEPLOYED",
    "COMPLETED",
    "QUEUED",
    "TERMINATED",
    "WAITING",
    "INITIALIZING",
    "IDLE",
    "SETTING_UP",
    "RESETTING",
  ]),
  jobRunId: z.string(),
  taskRunId: z.string(),
  timestamp: z.string(),
});

// Success response schema
export const zWebhookSuccessResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Error response schema
export const zWebhookErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

export type DatabricksWebhookPayload = z.infer<typeof zDatabricksWebhookPayload>;
export type DatabricksTaskRunStatus = DatabricksWebhookPayload["status"];
export type WebhookSuccessResponse = z.infer<typeof zWebhookSuccessResponse>;
export type WebhookErrorResponse = z.infer<typeof zWebhookErrorResponse>;
