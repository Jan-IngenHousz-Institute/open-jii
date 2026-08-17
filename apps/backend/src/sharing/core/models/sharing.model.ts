import type {
  ResourceGrantDto,
  ResourceOrgAdminsDto,
  ResourceOrgMembersDto,
  ResourceOwnerDto,
  ShareableRole,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";

/** The wire shape, but `createdAt` is still a `Date` until the controller formats it. */
export type EnrichedGrant = Omit<ResourceGrantDto, "createdAt"> & { createdAt: Date };

/** Everything the collaborators surface lists, at the repository's date fidelity. */
export type ResourceCollaborator =
  | ResourceOwnerDto
  | ResourceOrgAdminsDto
  | ResourceOrgMembersDto
  | EnrichedGrant;

export interface ResourceRef {
  resourceType: SharingResourceType;
  resourceId: string;
}

/** A plain direct-grant row: what the guarded write paths resolve to. */
export interface DirectGrantRow {
  id: string;
  role: string;
}

export interface CreateGrantInput extends ResourceRef {
  granteeType: SharingGranteeType;
  granteeId: string;
  // The grantable set, not the stored one: a caller may not mint an `owner`, though a
  // row that already holds one still reads back.
  role: ShareableRole;
  createdBy: string;
}
