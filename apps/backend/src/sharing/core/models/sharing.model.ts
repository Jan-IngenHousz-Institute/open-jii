import type {
  GrantRole,
  ResourceGrantDto,
  ResourceOwnerDto,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";

/** The wire shape, but `createdAt` is still a `Date` until the controller formats it. */
export type EnrichedGrant = Omit<ResourceGrantDto, "createdAt"> & { createdAt: Date };

/** Everything the collaborators surface lists, at the repository's date fidelity. */
export type ResourceCollaborator = ResourceOwnerDto | EnrichedGrant;

/** A plain direct-grant row: what the guarded write paths resolve to. */
export interface DirectGrantRow {
  id: string;
  role: string;
}

export interface CreateGrantInput {
  resourceType: SharingResourceType;
  resourceId: string;
  granteeType: SharingGranteeType;
  granteeId: string;
  role: GrantRole;
  createdBy: string;
}
