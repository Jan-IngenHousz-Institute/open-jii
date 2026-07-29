import { z } from "zod";

/**
 * Bulk hand-off of admin rights, used by the account-deletion flow: each entry
 * gives the target user a direct `admin` grant on one experiment the caller is
 * currently the sole admin of, clearing that deletion blocker.
 */
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

export type TransferExperimentAdminBody = z.infer<typeof zTransferExperimentAdminBody>;
export type TransferExperimentAdminResult = z.infer<typeof zTransferExperimentAdminResult>;
export type TransferExperimentAdminResponse = z.infer<typeof zTransferExperimentAdminResponse>;
