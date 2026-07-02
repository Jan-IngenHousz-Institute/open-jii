import { z } from "zod";

import { zExperimentMemberRole } from "../experiment.schema";

export const zExperimentMember = z.object({
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  role: zExperimentMemberRole,
  joinedAt: z.string().datetime(),
  experimentId: z.string().uuid().optional(),
});

export const zExperimentMemberList = z.array(zExperimentMember);

export const zAddExperimentMembersBody = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid().describe("ID of the user to add as a member"),
      role: zExperimentMemberRole
        .optional()
        .default("member")
        .describe("ExperimentRole to assign to the new member"),
    }),
  ),
});

export const zUpdateExperimentMemberRoleBody = z.object({
  role: zExperimentMemberRole.describe("New role to assign to the member"),
});

// Bulk hand-off of admin rights used by the account-deletion flow: each entry promotes (or adds)
// the target user as an admin of one experiment the caller is currently sole admin of.
export const zTransferExperimentAdminBody = z.object({
  transfers: z
    .array(
      z.object({
        experimentId: z.string().uuid().describe("Experiment to transfer admin rights on"),
        targetUserId: z.string().uuid().describe("User to make an admin of the experiment"),
      }),
    )
    .min(1)
    .describe("Per-experiment admin assignments"),
});

export const zTransferExperimentAdminResult = z.object({
  experimentId: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const zTransferExperimentAdminResponse = z.object({
  results: z.array(zTransferExperimentAdminResult),
});

export const zExperimentMemberPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  memberId: z.string().uuid().describe("ID of the member"),
});

export type ExperimentMember = z.infer<typeof zExperimentMember>;
export type ExperimentMemberList = z.infer<typeof zExperimentMemberList>;
export type AddExperimentMembersBody = z.infer<typeof zAddExperimentMembersBody>;
export type UpdateExperimentMemberRoleBody = z.infer<typeof zUpdateExperimentMemberRoleBody>;
export type TransferExperimentAdminBody = z.infer<typeof zTransferExperimentAdminBody>;
export type TransferExperimentAdminResult = z.infer<typeof zTransferExperimentAdminResult>;
export type TransferExperimentAdminResponse = z.infer<typeof zTransferExperimentAdminResponse>;
export type ExperimentMemberPathParam = z.infer<typeof zExperimentMemberPathParam>;
