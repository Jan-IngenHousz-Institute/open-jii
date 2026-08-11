import type {
  GranteeTeam,
  OrganizationDeletionBlockers,
  MyOrganization,
  OrganizationDirectoryEntry,
  OrganizationMember,
  OrganizationMembershipStatus,
  OrganizationProfile,
  OrganizationResource,
  OrganizationTeam,
  OutsideCollaborator,
} from "@repo/api/domains/organization/organization.schema";

/**
 * The organization DTOs are the contract shapes verbatim — this domain is reads
 * over Better Auth's own models, so there is no separate persistence shape to map
 * from. Dates are the exception: repositories return `Date`, the controllers
 * serialize.
 */
export type OrganizationDirectoryEntryDto = OrganizationDirectoryEntry;
export type OrganizationProfileDto = OrganizationProfile;
export type MyOrganizationDto = MyOrganization;
export type OrganizationResourceDto = Omit<OrganizationResource, "updatedAt"> & {
  updatedAt: Date;
};
export type OrganizationMemberDto = Omit<OrganizationMember, "joinedAt"> & { joinedAt: Date };
export type OutsideCollaboratorDto = OutsideCollaborator;
export type OrganizationTeamDto = Omit<OrganizationTeam, "createdAt"> & { createdAt: Date };
export type GranteeTeamDto = GranteeTeam;
export type OrganizationDeletionBlockersDto = OrganizationDeletionBlockers;
export type MembershipStatus = OrganizationMembershipStatus;

/** Everything the read use-cases need to decide what a caller may see. */
export interface OrganizationAccessRow {
  id: string;
  slug: string | null;
  visibility: "private" | "public";
  /** The caller's stored role string, or `null` when they are not a member. */
  memberRole: string | null;
}
