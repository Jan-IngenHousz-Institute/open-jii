import type { DatabaseInstance } from "./database";
import { resourceGrants } from "./schema";

export type ResourceType = (typeof resourceGrants.resourceType.enumValues)[number];
export type GranteeType = (typeof resourceGrants.granteeType.enumValues)[number];

export interface ResourceGrantInput {
  resourceType: ResourceType;
  resourceId: string;
  granteeType: GranteeType;
  granteeId: string;
  role?: string;
  createdBy?: string | null;
}

/** Idempotently grant a role on a resource to a user/org/team. */
export async function grantResource(
  db: DatabaseInstance,
  grant: ResourceGrantInput,
): Promise<void> {
  await db
    .insert(resourceGrants)
    .values({
      resourceType: grant.resourceType,
      resourceId: grant.resourceId,
      granteeType: grant.granteeType,
      granteeId: grant.granteeId,
      role: grant.role ?? "member",
      createdBy: grant.createdBy ?? null,
    })
    .onConflictDoNothing();
}
