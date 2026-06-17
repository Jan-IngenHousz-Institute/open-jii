import { eq, isNull } from "drizzle-orm";

import type { DatabaseInstance } from "./database";
import { ensurePersonalOrganization } from "./organizations";
import {
  experimentMembers,
  experiments,
  macros,
  protocols,
  resourceGrants,
  workbooks,
} from "./schema";

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

/**
 * Backfill org ownership + an owner grant for a single-owner entity (macro,
 * protocol, workbook): set organizationId to the creator's personal org and
 * grant the creator admin. Idempotent.
 */
async function backfillOwnedEntity(
  db: DatabaseInstance,
  resourceType: ResourceType,
  table: typeof macros | typeof protocols | typeof workbooks,
): Promise<number> {
  const rows = await db
    .select({ id: table.id, createdBy: table.createdBy })
    .from(table)
    .where(isNull(table.organizationId));

  for (const row of rows) {
    const organizationId = await ensurePersonalOrganization(db, { id: row.createdBy });
    await db.update(table).set({ organizationId }).where(eq(table.id, row.id));
    await grantResource(db, {
      resourceType,
      resourceId: row.id,
      granteeType: "user",
      granteeId: row.createdBy,
      role: "admin",
      createdBy: row.createdBy,
    });
  }
  return rows.length;
}

/** Backfill org ownership + owner grants for macros, protocols, and workbooks. */
export async function backfillOwnedEntitiesOwnership(
  db: DatabaseInstance,
): Promise<{ macros: number; protocols: number; workbooks: number }> {
  return {
    macros: await backfillOwnedEntity(db, "macro", macros),
    protocols: await backfillOwnedEntity(db, "protocol", protocols),
    workbooks: await backfillOwnedEntity(db, "workbook", workbooks),
  };
}
