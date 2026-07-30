import { z } from "zod";

import { zSharingResourceType } from "../sharing.schema";

/**
 * Bulk hand-off of admin rights, used by the account-deletion flow: each entry
 * gives the target user a direct `admin` grant on one resource the caller is
 * currently the sole admin of, clearing that deletion blocker. Any of the four
 * shareable types can block a deletion, so each entry names its own resource type.
 */
export const zTransferResourceAdminBody = z.object({
  transfers: z
    .array(
      z.object({
        resourceType: zSharingResourceType.describe("Type of resource to transfer admin on"),
        resourceId: z.string().uuid().describe("Resource to transfer admin rights on"),
        targetUserId: z.string().uuid().describe("User to make an admin of the resource"),
      }),
    )
    .min(1)
    .describe("Per-resource admin assignments"),
});

export const zTransferResourceAdminResult = z.object({
  resourceType: zSharingResourceType,
  resourceId: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const zTransferResourceAdminResponse = z.object({
  results: z.array(zTransferResourceAdminResult),
});

export type TransferResourceAdminBody = z.infer<typeof zTransferResourceAdminBody>;
export type TransferResourceAdminResult = z.infer<typeof zTransferResourceAdminResult>;
export type TransferResourceAdminResponse = z.infer<typeof zTransferResourceAdminResponse>;
