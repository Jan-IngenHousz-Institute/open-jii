import { eq, isNull } from "drizzle-orm";

import type { DatabaseInstance } from "./database";
import { ensurePersonalOrganization } from "./organizations";
import { experimentMembers, experiments, resourceGrants } from "./schema";

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

/**
 * Backfill org ownership + per-resource grants for experiments:
 *  - set experiments.organizationId to the creator's personal org (where null)
 *  - copy experiment_members into resource_grants (experiment scope)
 * Idempotent — safe to re-run.
 */
export async function backfillExperimentOrganizationsAndGrants(
  db: DatabaseInstance,
): Promise<{ experimentsUpdated: number; grantsCreated: number }> {
  const rows = await db
    .select({ id: experiments.id, createdBy: experiments.createdBy })
    .from(experiments)
    .where(isNull(experiments.organizationId));

  for (const exp of rows) {
    const organizationId = await ensurePersonalOrganization(db, { id: exp.createdBy });
    await db.update(experiments).set({ organizationId }).where(eq(experiments.id, exp.id));
  }

  const members = await db
    .select({
      experimentId: experimentMembers.experimentId,
      userId: experimentMembers.userId,
      role: experimentMembers.role,
    })
    .from(experimentMembers);

  for (const m of members) {
    await grantResource(db, {
      resourceType: "experiment",
      resourceId: m.experimentId,
      granteeType: "user",
      granteeId: m.userId,
      role: m.role,
    });
  }

  return { experimentsUpdated: rows.length, grantsCreated: members.length };
}
