import { z } from "zod";

/** Shareable resource types (mirrors the resource_grants.resource_type enum). */
export const zResourceType = z.enum(["experiment", "macro", "protocol", "workbook", "device"]);

/** Who a grant is for. */
export const zGranteeType = z.enum(["user", "organization", "team"]);

/** Role conferred by a grant. */
export const zGrantRole = z.enum(["owner", "admin", "member", "viewer"]);

export const zResourceGrantPathParams = z.object({
  resourceType: zResourceType,
  resourceId: z.string().uuid(),
});

export const zRevokeGrantPathParams = zResourceGrantPathParams.extend({
  grantId: z.string().uuid(),
});

export const zResourceGrant = z.object({
  id: z.string().uuid(),
  resourceType: zResourceType,
  resourceId: z.string().uuid(),
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  role: z.string(),
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable(),
});
export const zResourceGrantList = z.array(zResourceGrant);

export const zCreateResourceGrantBody = z.object({
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  role: zGrantRole.default("member"),
});

export const zRevokeGrantResponse = z.object({ success: z.boolean() });

export const zSharingErrorResponse = z.object({ message: z.string() });

export type ResourceTypeValue = z.infer<typeof zResourceType>;
export type GranteeTypeValue = z.infer<typeof zGranteeType>;
export type ResourceGrantDto = z.infer<typeof zResourceGrant>;
export type CreateResourceGrantBody = z.infer<typeof zCreateResourceGrantBody>;
