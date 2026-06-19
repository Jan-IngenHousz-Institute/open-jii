import { z } from "zod";

/** Shareable resource types (mirrors the resource_grants.resource_type enum). */
export const zResourceType = z.enum(["experiment", "macro", "protocol", "workbook", "device"]);

/** Who a grant is for. */
export const zGranteeType = z.enum(["user", "organization", "team"]);

/** Role conferred by a grant. */
export const zGrantRole = z.enum(["owner", "admin", "member", "viewer"]);

/** Resource visibility (mirrors the shared visibility enum). */
export const zVisibility = z.enum(["private", "public"]);

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

/** Display info for whoever a grant is for (person, org, or team). */
export const zGrantee = z.object({
  type: zGranteeType,
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** For user grantees: whether they belong to the resource's owning org
   *  (false → shown as an "Outside Collaborator"). Always true for org/team. */
  isOrgMember: z.boolean(),
});

/** A grant enriched with its grantee's display info, for the sharing list UI. */
export const zResourceGrantWithGrantee = zResourceGrant.extend({
  grantee: zGrantee,
});
export const zResourceGrantWithGranteeList = z.array(zResourceGrantWithGrantee);

export const zCreateResourceGrantBody = z.object({
  granteeType: zGranteeType,
  granteeId: z.string().uuid(),
  role: zGrantRole.default("member"),
});

export const zUpdateResourceGrantBody = z.object({
  role: zGrantRole,
});

export const zRevokeGrantResponse = z.object({ success: z.boolean() });

/** The caller's effective permissions on a resource (drives UI gating). */
export const zResourceAccess = z.object({
  canRead: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
  canShare: z.boolean(),
  /** Caller is a collaborator (has a role/grant), not just a public-read viewer. */
  isCollaborator: z.boolean(),
  /** Owning org + visibility, for the GitHub-style collaborators cards. */
  organizationId: z.string().uuid().nullable(),
  visibility: zVisibility.nullable(),
});

export const zSharingErrorResponse = z.object({ message: z.string() });

export type ResourceTypeValue = z.infer<typeof zResourceType>;
export type GranteeTypeValue = z.infer<typeof zGranteeType>;
export type GrantRoleValue = z.infer<typeof zGrantRole>;
export type ResourceGrantDto = z.infer<typeof zResourceGrant>;
export type ResourceGrantWithGranteeDto = z.infer<typeof zResourceGrantWithGrantee>;
export type GranteeDto = z.infer<typeof zGrantee>;
export type CreateResourceGrantBody = z.infer<typeof zCreateResourceGrantBody>;
export type UpdateResourceGrantBody = z.infer<typeof zUpdateResourceGrantBody>;
