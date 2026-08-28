import { z } from "zod";

import { zResourceScope } from "../../shared/listing";
import { zExperimentStatus } from "../experiment/experiment.schema";
import { zDeviceType } from "../iot/iot.schema";
import { zMacroLanguage } from "../macro/macro.schema";
import { zSensorFamily } from "../protocol/protocol.schema";
import { zGrantRole, zSharingResourceType } from "../sharing/sharing.schema";

/** Mirrors the `organization_type` enum; organizations may leave it unset. */
export const zOrganizationType = z.enum([
  "research_institute",
  "non_profit",
  "private_company",
  "government_agency",
  "university",
]);
export type OrganizationType = z.infer<typeof zOrganizationType>;

/**
 * Every visible organization-type label the search service accepts. Kept beside
 * {@link zOrganizationType} so a new enum member cannot silently become unsearchable;
 * the web locale contract tests keep these aliases aligned with the translated labels.
 */
export const ORGANIZATION_TYPE_SEARCH_ALIASES = {
  research_institute: "Research institute Forschungsinstitut Onderzoeksinstituut",
  non_profit: "Non-profit non profit nonprofit Gemeinnützige Organisation",
  private_company: "Private company Privatunternehmen Particulier bedrijf",
  government_agency: "Government agency Behörde Overheidsinstantie",
  university: "University Universität Universiteit",
} as const satisfies Record<OrganizationType, string>;

/** Directory listing state. Private organizations are invisible to non-members. */
export const zOrganizationVisibility = z.enum(["private", "public"]);

/** Canonical organization roles (Better Auth's `member` model). */
export const zOrganizationRole = z.enum(["owner", "admin", "member"]);

/**
 * What the caller's relationship to an organization is, which is all the directory
 * needs to pick between "Join", "Requested" and "Open". Deliberately not a role:
 * the directory shows public organizations to people who are not in them.
 */
export const zOrganizationMembershipStatus = z.enum(["none", "pending_request", "member"]);

export const zOrganizationIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the organization"),
});

export const zOrganizationDirectoryQuery = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe(
      "Name, description, location or type; also member and team names, for organizations you belong to",
    ),
  /**
   * The same `scope` the experiment, macro and protocol listings take. `related` narrows
   * to the caller's own memberships — a filter over this one query, not a second
   * endpoint, so both slices match and rank identically.
   */
  scope: zResourceScope.optional().describe("Which slice of the visible set to return"),
});

/**
 * A directory row: non-personal organizations that are public **or** that the caller
 * belongs to. "All organizations" means all the ones they can see, which is the same
 * promise the experiments listing makes — a private organization you are a member of
 * is not a secret from you.
 */
export const zOrganizationDirectoryEntry = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  logo: z.string().nullable(),
  type: zOrganizationType.nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  memberCount: z.number().int(),
  /**
   * How much of what the organization owns *this caller* can reach, summed across every
   * owned type. Access-scoped, so two callers reading the same row can legitimately
   * see different totals — a non-member's is the public part.
   */
  resourceCount: z.number().int(),
  /**
   * Carried, not assumed. The directory used to be public-only, so a row's visibility
   * was knowable without asking; now that a member's private organizations appear here
   * too, a row that did not say would be rendered as public and lose its badge.
   */
  visibility: zOrganizationVisibility,
  membershipStatus: zOrganizationMembershipStatus,
});

export const zOrganizationDirectory = z.object({
  organizations: z.array(zOrganizationDirectoryEntry),
});

/** The organization profile page. Private organizations 404 for non-members. */
export const zOrganizationProfile = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  logo: z.string().nullable(),
  type: zOrganizationType.nullable(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  location: z.string().nullable(),
  visibility: zOrganizationVisibility,
  memberCount: z.number().int(),
  /**
   * How much of what the organization owns *this caller* can reach, summed across every
   * owned type — scoped the same way the directory row is, so the profile and the
   * listing cannot disagree about the same organization for the same caller.
   */
  resourceCount: z.number().int(),
  /** When the organization was created, for the profile's "on openJII since" row. */
  createdAt: z.string().datetime(),
  /** The caller's own role, or `null` when they are not a member. */
  role: zOrganizationRole.nullable(),
  membershipStatus: zOrganizationMembershipStatus,
});

/** An organization the caller belongs to. Personal workspaces are included, flagged. */
export const zMyOrganization = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  description: z.string().nullable(),
  visibility: zOrganizationVisibility,
  role: zOrganizationRole,
  isPersonal: z.boolean(),
  memberCount: z.number().int(),
  /**
   * How much of what the organization owns this caller can reach, summed across every
   * owned type. Scoped like the rest, though the caller is always a member here.
   */
  resourceCount: z.number().int(),
});

export const zMyOrganizationList = z.array(zMyOrganization);

/** Profile fields every people-shaped row in this domain carries. */
const zOrganizationPerson = z.object({
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  // Stored value returned as-is; format-validating on output can 500 the list.
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const zOrganizationMember = zOrganizationPerson.extend({
  /** Stored verbatim: Better Auth may hold a comma-joined multi-role string. */
  role: z.string(),
  joinedAt: z.string().datetime(),
});

export const zOrganizationMembers = z.object({
  members: z.array(zOrganizationMember),
});

/** What every showcase row carries, whatever its type. */
const zOrganizationResourceBase = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: zOrganizationVisibility,
  updatedAt: z.string().datetime(),
  /**
   * How many people and groups hold this resource, by the same definition the
   * collaborators surface lists: the org's living owners plus every grant, a team or
   * org grant counting as the one grantee it is.
   */
  collaboratorCount: z.number().int(),
});

/**
 * One row of the organization's resources showcase, one variant per member of
 * {@link zSharingResourceType}. Discriminated rather than flattened because the extra
 * fact worth showing differs per type, and a workbook has none.
 */
export const zOrganizationResource = z.discriminatedUnion("type", [
  zOrganizationResourceBase.extend({
    type: z.literal("experiment"),
    status: zExperimentStatus,
  }),
  zOrganizationResourceBase.extend({
    type: z.literal("protocol"),
    family: zSensorFamily,
  }),
  zOrganizationResourceBase.extend({
    type: z.literal("macro"),
    language: zMacroLanguage,
  }),
  zOrganizationResourceBase.extend({ type: z.literal("workbook") }),
  zOrganizationResourceBase.extend({
    type: z.literal("device"),
    /** The device's class — `zSensorFamily` renamed, so it badges like a protocol's. */
    deviceType: zDeviceType,
  }),
  zOrganizationResourceBase.extend({
    type: z.literal("device_group"),
    /** How many devices the group holds; stated in the footer, not as a badge. */
    memberCount: z.number().int(),
  }),
]);

/**
 * Compile-time guard: a discriminated union is not exhaustive on its own, so without
 * this a newly grantable type would type-check with no showcase row. Anything
 * uncovered names itself in the error.
 */
type UncoveredOwnedType = Exclude<
  z.infer<typeof zSharingResourceType>,
  z.infer<typeof zOrganizationResource>["type"]
>;
type MustBeCovered<T extends never> = T;
export type EveryOwnedTypeHasAShowcaseRow = MustBeCovered<UncoveredOwnedType>;

/**
 * How many of each owned type the caller may read, alongside the rows. Scoped exactly
 * as the rows are, so a group header cannot promise more than "view all" would show.
 */
export const zOrganizationResourceTotals = z.object({
  experiment: z.number().int(),
  protocol: z.number().int(),
  macro: z.number().int(),
  workbook: z.number().int(),
  device: z.number().int(),
  device_group: z.number().int(),
}) satisfies z.ZodType<Record<z.infer<typeof zSharingResourceType>, number>>;

export const zOrganizationResources = z.object({
  resources: z.array(zOrganizationResource),
  totals: zOrganizationResourceTotals,
});

/**
 * What still stands between an organization and deletion, one row per resource type
 * that holds at least one of its resources.
 *
 * Deliberately not the resources showcase: that is access-scoped, while the delete
 * guard counts the whole estate. An organization holding one private resource the
 * caller cannot read would otherwise look deletable right up to the confirmation.
 */
export const zOrganizationDeletionBlocker = z.object({
  resourceType: zSharingResourceType,
  count: z.number().int().positive(),
});

export const zOrganizationDeletionBlockers = z.object({
  /** Only the types that actually hold something; an empty array means deletable. */
  blockers: z.array(zOrganizationDeletionBlocker),
  total: z.number().int(),
});

export const zOrganizationTeamMember = zOrganizationPerson;

export const zOrganizationTeam = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  members: z.array(zOrganizationTeamMember),
});

export const zOrganizationTeamList = z.array(zOrganizationTeam);

/**
 * One resource a team can reach because the team itself was named on a grant — the
 * team → resources direction, which `listGranteeTeams` answers in reverse.
 *
 * `resourceType` is the grant enum: a footer counting "N resources" that quietly
 * omitted a type would understate what deleting the team withdraws.
 */
export const zOrganizationTeamGrant = z.object({
  id: z.string().uuid().describe("ID of the grant row"),
  teamId: z.string().uuid(),
  resourceType: zSharingResourceType,
  resourceId: z.string().uuid(),
  /**
   * Always something to render. A device is the one type whose `name` is nullable, so
   * an unnamed one falls back server-side to its thing name — never to a placeholder,
   * because the read inner-joins the resource: a blank name is a naming gap, and a
   * resource that has gone is not in this list at all.
   */
  resourceName: z.string(),
  role: zGrantRole,
});

export const zOrganizationTeamGrantList = z.array(zOrganizationTeamGrant);

/** A team the caller may pick as a grantee: teams of the resource's owning org. */
export const zGranteeTeam = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organizationId: z.string().uuid(),
  memberCount: z.number().int(),
});

export const zGranteeTeamList = z.array(zGranteeTeam);

/**
 * Path params for the share-gated team picker. {@link zSharingResourceType} itself
 * rather than a copy of its values, so it mirrors the sharing contract by construction.
 * Devices included — a team can hold a grant on one like anything else.
 */
export const zGranteeTeamsPathParams = z.object({
  resourceType: zSharingResourceType,
  id: z.string().uuid().describe("ID of the resource being shared"),
});

export type OrganizationVisibility = z.infer<typeof zOrganizationVisibility>;
export type OrganizationRole = z.infer<typeof zOrganizationRole>;
export type OrganizationMembershipStatus = z.infer<typeof zOrganizationMembershipStatus>;
export type OrganizationDirectoryQuery = z.infer<typeof zOrganizationDirectoryQuery>;
export type OrganizationDirectoryEntry = z.infer<typeof zOrganizationDirectoryEntry>;
export type OrganizationDirectory = z.infer<typeof zOrganizationDirectory>;
export type OrganizationProfile = z.infer<typeof zOrganizationProfile>;
export type MyOrganization = z.infer<typeof zMyOrganization>;
export type MyOrganizationList = z.infer<typeof zMyOrganizationList>;
export type OrganizationMember = z.infer<typeof zOrganizationMember>;
export type OrganizationMembers = z.infer<typeof zOrganizationMembers>;
export type OrganizationResource = z.infer<typeof zOrganizationResource>;
export type OrganizationResourceTotals = z.infer<typeof zOrganizationResourceTotals>;
export type OrganizationResources = z.infer<typeof zOrganizationResources>;
export type OrganizationDeletionBlocker = z.infer<typeof zOrganizationDeletionBlocker>;
export type OrganizationDeletionBlockers = z.infer<typeof zOrganizationDeletionBlockers>;
export type OrganizationTeamMember = z.infer<typeof zOrganizationTeamMember>;
export type OrganizationTeam = z.infer<typeof zOrganizationTeam>;
export type OrganizationTeamList = z.infer<typeof zOrganizationTeamList>;
export type OrganizationTeamGrant = z.infer<typeof zOrganizationTeamGrant>;
export type OrganizationTeamGrantList = z.infer<typeof zOrganizationTeamGrantList>;
export type GranteeTeam = z.infer<typeof zGranteeTeam>;
export type GranteeTeamList = z.infer<typeof zGranteeTeamList>;
