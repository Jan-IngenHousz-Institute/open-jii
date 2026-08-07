import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zInvitationTier } from "@repo/api/domains/user/user.schema";
import type { invitationStatusEnum, invitationResourceTypeEnum } from "@repo/database";
import { invitations } from "@repo/database";

// Types from DB enums
export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number];
export type InvitationResourceType = (typeof invitationResourceTypeEnum.enumValues)[number];

// Create schema for inserting an invitation (experiment-scoped for now)
export const createInvitationSchema = createInsertSchema(invitations)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
  })
  .extend({
    resourceType: z.literal("experiment"),
    resourceId: z.string().uuid(),
  });

// Select schema for returning invitations. The `role` column is surfaced as the
// access `tier`; see `invitationColumns` in the repository.
export const invitationSchema = createSelectSchema(invitations)
  .omit({ role: true })
  .extend({
    resourceType: z.literal("experiment"),
    resourceId: z.string().uuid(),
    tier: zInvitationTier,
    invitedByName: z.string().optional(),
    resourceName: z.string().optional(),
  });

// DTOs
export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;
export type InvitationDto = z.infer<typeof invitationSchema>;
