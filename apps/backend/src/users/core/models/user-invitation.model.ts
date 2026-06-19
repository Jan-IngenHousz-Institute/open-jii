import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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

// Select schema for returning invitations. resourceType spans all invitable
// resources (experiment + the per-resource grant types); resourceId is null only
// for platform invitations.
export const invitationSchema = createSelectSchema(invitations).extend({
  resourceType: z.enum(["platform", "experiment", "macro", "protocol", "workbook", "device"]),
  resourceId: z.string().uuid().nullable(),
  invitedByName: z.string().optional(),
  resourceName: z.string().optional(),
});

// DTOs
export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;
export type InvitationDto = z.infer<typeof invitationSchema>;
