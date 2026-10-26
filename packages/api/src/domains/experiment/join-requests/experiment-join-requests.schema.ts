import { z } from "zod";

export const zExperimentJoinRequestStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const zExperimentJoinRequest = z.object({
  id: z.string().guid(),
  experimentId: z.string().guid(),
  user: z.object({
    id: z.string().guid(),
    firstName: z.string(),
    lastName: z.string(),
    // Stored value returned as-is; format-validating on output can 500 the list.
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  message: z.string().nullable(),
  status: zExperimentJoinRequestStatus,
  decidedBy: z.string().guid().nullable(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentJoinRequestList = z.array(zExperimentJoinRequest);

export const zExperimentCreateJoinRequestBody = z.object({
  message: z
    .string()
    .max(250, "Message must be 250 characters or less")
    .optional()
    .describe("Optional short message to the project admins"),
});

export const zExperimentJoinRequestPathParam = z.object({
  id: z.string().guid().describe("ID of the experiment"),
  requestId: z.string().guid().describe("ID of the join request"),
});

export type ExperimentJoinRequestStatus = z.infer<typeof zExperimentJoinRequestStatus>;
export type ExperimentJoinRequest = z.infer<typeof zExperimentJoinRequest>;
export type ExperimentJoinRequestList = z.infer<typeof zExperimentJoinRequestList>;
export type ExperimentCreateJoinRequestBody = z.infer<typeof zExperimentCreateJoinRequestBody>;
export type ExperimentJoinRequestPathParam = z.infer<typeof zExperimentJoinRequestPathParam>;
