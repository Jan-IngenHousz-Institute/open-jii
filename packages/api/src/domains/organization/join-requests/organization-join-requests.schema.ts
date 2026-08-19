import { z } from "zod";

export const zOrganizationJoinRequestStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const zOrganizationJoinRequest = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    // Stored value returned as-is; format-validating on output can 500 the list.
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  message: z.string().nullable(),
  status: zOrganizationJoinRequestStatus,
  decidedBy: z.string().uuid().nullable(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zOrganizationJoinRequestList = z.array(zOrganizationJoinRequest);

export const zCreateOrganizationJoinRequestBody = z.object({
  message: z
    .string()
    .max(250, "Message must be 250 characters or less")
    .optional()
    .describe("Optional short message to the organization's owners and admins"),
});

export const zOrganizationJoinRequestPathParam = z.object({
  id: z.string().uuid().describe("ID of the organization"),
  requestId: z.string().uuid().describe("ID of the join request"),
});

/** Approve or reject: one endpoint, because both are the same state transition. */
export const zDecideOrganizationJoinRequestBody = z.object({
  decision: z.enum(["approve", "reject"]),
});

export type OrganizationJoinRequestStatus = z.infer<typeof zOrganizationJoinRequestStatus>;
export type OrganizationJoinRequest = z.infer<typeof zOrganizationJoinRequest>;
export type OrganizationJoinRequestList = z.infer<typeof zOrganizationJoinRequestList>;
export type CreateOrganizationJoinRequestBody = z.infer<typeof zCreateOrganizationJoinRequestBody>;
export type OrganizationJoinRequestPathParam = z.infer<typeof zOrganizationJoinRequestPathParam>;
export type DecideOrganizationJoinRequestBody = z.infer<typeof zDecideOrganizationJoinRequestBody>;
