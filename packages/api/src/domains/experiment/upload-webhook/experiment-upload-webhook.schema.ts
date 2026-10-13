import { z } from "zod";

export const zExperimentUploadOutcome = z.enum(["ready", "failed"]);

export const zExperimentUploadWebhookPayload = z.object({
  experimentId: z.string().uuid(),
  uploadId: z.string().uuid(),
  userId: z.string().uuid().describe("User who started the upload"),
  outcome: zExperimentUploadOutcome.describe(
    "ready once the upload's rows are in its table, failed when they will not arrive",
  ),
  uploadTableName: z.string().min(1).describe("Table the upload was written to"),
});

export const zExperimentUploadWebhookResponse = z.object({
  success: z.boolean(),
});

export type ExperimentUploadOutcome = z.infer<typeof zExperimentUploadOutcome>;
export type ExperimentUploadWebhookPayload = z.infer<typeof zExperimentUploadWebhookPayload>;
export type ExperimentUploadWebhookResponse = z.infer<typeof zExperimentUploadWebhookResponse>;
