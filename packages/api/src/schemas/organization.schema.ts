import { z } from "zod";

export const zOrganizationVisibility = z.enum(["private", "public"]);

export const zOrganizationType = z.enum([
  "research_institute",
  "non_profit",
  "private_company",
  "government_agency",
  "university",
]);

/** The caller's relationship to an organization (drives directory/profile CTAs). */
export const zMembershipStatus = z.enum(["member", "pending", "none"]);

export const zOrganizationJoinRequestStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

/** A public-directory / profile summary of an organization. */
export const zOrganizationSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  logo: z.string().nullable(),
  type: zOrganizationType.nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  location: z.string().nullable(),
  visibility: zOrganizationVisibility,
  memberCount: z.number(),
  membershipStatus: zMembershipStatus,
  createdAt: z.string(),
});
export const zOrganizationSummaryList = z.array(zOrganizationSummary);

/** A lightweight entity card for an org's public-resources showcase. */
export const zOrganizationResourceItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

/** An org's public resources, grouped by entity type ("what they're up to"). */
export const zOrganizationResources = z.object({
  experiments: z.array(zOrganizationResourceItem),
  macros: z.array(zOrganizationResourceItem),
  protocols: z.array(zOrganizationResourceItem),
  workbooks: z.array(zOrganizationResourceItem),
  devices: z.array(zOrganizationResourceItem),
});

export const zOrganizationJoinRequest = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  message: z.string().nullable(),
  status: zOrganizationJoinRequestStatus,
  decidedBy: z.string().uuid().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const zOrganizationJoinRequestList = z.array(zOrganizationJoinRequest);

/** A member of an organization (for the "Organization access" tab). */
export const zOrganizationMember = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
});

/** A team within an organization (for the "Organization access" tab). */
export const zOrganizationTeam = z.object({
  id: z.string().uuid(),
  name: z.string(),
  memberCount: z.number(),
});

/** Who inherits access to a resource through its owning org (members + teams). */
export const zOrganizationAccess = z.object({
  organization: zOrganizationSummary,
  members: z.array(zOrganizationMember),
  teams: z.array(zOrganizationTeam),
});

export const zOrganizationIdPathParam = z.object({ id: z.string().uuid() });
export const zOrganizationJoinRequestPathParam = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
});

export const zListPublicOrganizationsQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const zCreateOrganizationJoinRequestBody = z.object({
  message: z.string().max(250).optional(),
});

export const zOrganizationErrorResponse = z.object({ message: z.string() });

export type OrganizationVisibility = z.infer<typeof zOrganizationVisibility>;
export type OrganizationTypeValue = z.infer<typeof zOrganizationType>;
export type MembershipStatus = z.infer<typeof zMembershipStatus>;
export type OrganizationSummary = z.infer<typeof zOrganizationSummary>;
export type OrganizationResources = z.infer<typeof zOrganizationResources>;
export type OrganizationAccess = z.infer<typeof zOrganizationAccess>;
export type OrganizationJoinRequestDto = z.infer<typeof zOrganizationJoinRequest>;
