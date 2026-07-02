import { z } from "zod";

export const zExperimentTransferRequestStatus = z.enum([
  "pending",
  "approved",
  "partial_failed",
  "completed",
  "rejected",
  "failed",
]);

export const zExperimentTransferRequest = z.object({
  requestId: z.string().uuid(),
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  sourcePlatform: z.string(),
  projectIdOld: z.string(),
  projectUrlOld: z.string().url(),
  status: zExperimentTransferRequestStatus,
  requestedAt: z.string().datetime(),
});

export const zExperimentCreateTransferRequestBody = z.object({
  projectIdOld: z.string().min(1, "Project ID is required").max(255).trim(),
  projectUrlOld: z.string().url("Must be a valid URL"),
});

export const zExperimentTransferRequestList = z.array(zExperimentTransferRequest);

export type ExperimentTransferRequestStatus = z.infer<typeof zExperimentTransferRequestStatus>;
export type ExperimentTransferRequest = z.infer<typeof zExperimentTransferRequest>;
export type ExperimentCreateTransferRequestBody = z.infer<
  typeof zExperimentCreateTransferRequestBody
>;
export type ExperimentTransferRequestList = z.infer<typeof zExperimentTransferRequestList>;
