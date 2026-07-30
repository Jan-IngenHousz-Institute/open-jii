import { and, eq } from "drizzle-orm";

import type { DatabaseInstance, DbOrTx } from "./database";
import { resourceGrants } from "./schema";

export type ResourceType = (typeof resourceGrants.resourceType.enumValues)[number];
export type GranteeType = (typeof resourceGrants.granteeType.enumValues)[number];
/** A full `resource_grants` row. */
export type ResourceGrantRow = typeof resourceGrants.$inferSelect;

export interface ResourceGrantInput {
  resourceType: ResourceType;
  resourceId: string;
  granteeType: GranteeType;
  granteeId: string;
  role?: string;
  createdBy?: string | null;
}

/**
 * Idempotently grant a role on a resource to a user/org/team. Seed/backfill
 * tooling only: never overwrites an existing row. Runtime sharing uses
 * {@link upsertGrant}.
 */
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

/** The unique key of `resource_grants`: one grant per resource + grantee. */
const grantUniqueTarget = [
  resourceGrants.resourceType,
  resourceGrants.resourceId,
  resourceGrants.granteeType,
  resourceGrants.granteeId,
] as const;

/**
 * Grant roles that count as **staffing** a resource: they confer full control,
 * so at least one of them must survive on every shared resource. The last-admin
 * invariant, the account-deletion sole-admin blocker and the join-request admin
 * notifications all read user grants carrying one of these. Team and organization
 * grantees deliberately do not count — a named person has to be answerable for
 * the resource.
 */
export const STAFFING_GRANT_ROLES = ["owner", "admin"] as const;

export interface GrantInput {
  resourceType: ResourceType;
  resourceId: string;
  granteeType: GranteeType;
  granteeId: string;
  role: string;
  createdBy?: string | null;
}

/**
 * Create or update a grant. Re-sharing with an existing grantee updates their
 * role rather than adding a second row, since the unique key admits only one
 * grant per resource + grantee.
 */
export async function upsertGrant(db: DbOrTx, input: GrantInput): Promise<ResourceGrantRow> {
  const [row] = await db
    .insert(resourceGrants)
    .values({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      granteeType: input.granteeType,
      granteeId: input.granteeId,
      role: input.role,
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoUpdate({
      target: [...grantUniqueTarget],
      set: { role: input.role },
    })
    .returning();
  return row;
}

/**
 * Ensure `userId` holds a grant that **staffs** this resource. The two paths that
 * mint an admin tier outside the sharing endpoints both go through here: seeding a
 * resource's creator at create time, and handing admin to a transfer target.
 *
 * Idempotent, and never lowers anyone's access: a grantee who already holds a
 * staffing role (`owner` or `admin`) is left alone, so re-running can't demote an
 * `owner` to `admin`; a `viewer`/`member` grant is promoted to `admin`.
 *
 * That "raises only" property is why callers need no staffing guard: this can only
 * ever add a staffing grant, never remove the last one.
 */
export async function ensureDirectAdminGrant(
  db: DbOrTx,
  input: {
    resourceType: ResourceType;
    resourceId: string;
    userId: string;
    createdBy?: string | null;
  },
): Promise<void> {
  const existing = await db
    .select({ role: resourceGrants.role })
    .from(resourceGrants)
    .where(
      and(
        eq(resourceGrants.resourceType, input.resourceType),
        eq(resourceGrants.resourceId, input.resourceId),
        eq(resourceGrants.granteeType, "user"),
        eq(resourceGrants.granteeId, input.userId),
      ),
    )
    .limit(1);

  if (
    existing.length > 0 &&
    (STAFFING_GRANT_ROLES as readonly string[]).includes(existing[0].role)
  ) {
    return;
  }

  await upsertGrant(db, {
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    granteeType: "user",
    granteeId: input.userId,
    role: "admin",
    createdBy: input.createdBy ?? null,
  });
}

/**
 * Change the role of an existing grant, identified by id and scoped to its
 * resource so an id from another resource cannot be edited through it. Returns
 * the updated row, or undefined if no grant matched.
 */
export async function updateGrantRole(
  db: DbOrTx,
  params: { resourceType: ResourceType; resourceId: string; grantId: string; role: string },
): Promise<ResourceGrantRow | undefined> {
  const [row] = await db
    .update(resourceGrants)
    .set({ role: params.role })
    .where(
      and(
        eq(resourceGrants.id, params.grantId),
        eq(resourceGrants.resourceType, params.resourceType),
        eq(resourceGrants.resourceId, params.resourceId),
      ),
    )
    .returning();
  return row;
}

/**
 * Delete one grant, identified by id and scoped to its resource. Returns the
 * deleted row, or undefined if no grant matched.
 */
export async function deleteGrant(
  db: DbOrTx,
  params: { resourceType: ResourceType; resourceId: string; grantId: string },
): Promise<ResourceGrantRow | undefined> {
  const [row] = await db
    .delete(resourceGrants)
    .where(
      and(
        eq(resourceGrants.id, params.grantId),
        eq(resourceGrants.resourceType, params.resourceType),
        eq(resourceGrants.resourceId, params.resourceId),
      ),
    )
    .returning();
  return row;
}

/**
 * Delete a grantee's grant on **one** resource, keyed by the grantee rather
 * than the grant id — for self-leave, where the caller knows who they are but
 * has no way to learn their grant's id (the grants list is share-gated).
 */
export async function deleteGranteeGrant(
  db: DbOrTx,
  params: {
    resourceType: ResourceType;
    resourceId: string;
    granteeType: GranteeType;
    granteeId: string;
  },
): Promise<ResourceGrantRow | undefined> {
  const [row] = await db
    .delete(resourceGrants)
    .where(
      and(
        eq(resourceGrants.resourceType, params.resourceType),
        eq(resourceGrants.resourceId, params.resourceId),
        eq(resourceGrants.granteeType, params.granteeType),
        eq(resourceGrants.granteeId, params.granteeId),
      ),
    )
    .returning();
  return row;
}

/**
 * Delete every grant held **by a grantee** across all resources. For grantee
 * teardown (user deletion): access must not outlive the account, and
 * `resource_grants` is polymorphic on the grantee side too, so no FK cascade
 * removes these rows.
 */
export async function deleteGranteeGrants(
  db: DbOrTx,
  granteeId: string,
  granteeType: GranteeType = "user",
): Promise<void> {
  await db
    .delete(resourceGrants)
    .where(
      and(eq(resourceGrants.granteeType, granteeType), eq(resourceGrants.granteeId, granteeId)),
    );
}

/**
 * Delete **every** grant on a resource. For resource teardown (the resource
 * itself is going away): `resource_grants` is polymorphic, so there is no FK
 * cascade to clean them up and orphaned rows would otherwise linger and could be
 * re-associated with a future resource that reuses the id.
 */
export async function deleteResourceGrants(
  db: DbOrTx,
  resourceType: ResourceType,
  resourceId: string,
): Promise<void> {
  await db
    .delete(resourceGrants)
    .where(
      and(eq(resourceGrants.resourceType, resourceType), eq(resourceGrants.resourceId, resourceId)),
    );
}

/** List the grants on a resource. */
export async function listResourceGrants(
  db: DbOrTx,
  resourceType: ResourceType,
  resourceId: string,
) {
  return db
    .select()
    .from(resourceGrants)
    .where(
      and(eq(resourceGrants.resourceType, resourceType), eq(resourceGrants.resourceId, resourceId)),
    );
}
