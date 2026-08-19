import { APIError } from "better-auth/api";

import {
  and,
  db,
  eq,
  deviceGroups,
  experiments,
  iotDevices,
  isPersonalOrgSlug,
  macros,
  protocols,
  resourceGrants,
  sql,
  teams,
  workbooks,
} from "@repo/database";
import type { ResourceType, SQL } from "@repo/database";

/**
 * The resource tables an organization can own, with the noun each is counted in.
 * Deleting an organization is refused while any of them still points at it —
 * nothing here ever cascades, though the reason differs by table. Published work
 * should not disappear behind one confirm dialog; a device owns a live AWS Thing and
 * certificate that only its own delete path can tear down; and a device group, which
 * holds no work at all, carries grants that no foreign key reaches, cleaned only by
 * the group's own delete. What every row here shares is that dropping it by SQL
 * leaves something behind.
 *
 * A total `Record` over the grant enum, not a list: a newly org-owning resource
 * type has to appear here or this file stops compiling. Missed from a plain array
 * its rows would go uncounted, and the delete would fail on the constraint with
 * Postgres's own wording instead of the refusal naming what is in the way.
 */
const OWNED_RESOURCE_TABLES = {
  experiment: { table: experiments, singular: "experiment", plural: "experiments" },
  macro: { table: macros, singular: "macro", plural: "macros" },
  protocol: { table: protocols, singular: "protocol", plural: "protocols" },
  workbook: { table: workbooks, singular: "workbook", plural: "workbooks" },
  device: { table: iotDevices, singular: "device", plural: "devices" },
  device_group: { table: deviceGroups, singular: "device group", plural: "device groups" },
} as const satisfies Record<ResourceType, { table: unknown; singular: string; plural: string }>;

/** Personal workspaces exist for as long as their owner's account does. */
export function assertOrganizationIsDeletable(slug: string | null): void {
  if (isPersonalOrgSlug(slug)) {
    throw new APIError("BAD_REQUEST", {
      message: "Personal workspaces cannot be deleted.",
    });
  }
}

/**
 * Refuse the delete while the organization still owns anything.
 *
 * Counted rather than cascaded on purpose: published work should not vanish
 * behind one confirm dialog, and a device cannot be dropped by SQL at all. The
 * way out is to transfer each resource to another organization or delete it.
 *
 * The count races anything that gives the organization a resource after it runs and
 * before the row goes, and no lock taken here closes that: Better Auth calls this
 * hook *before* `adapter.deleteOrganization`, which opens its own transaction, and
 * hands the hook no adapter or transaction handle — so a `FOR UPDATE` taken here
 * commits and releases before the delete begins.
 *
 * What closes it is the constraint rather than the count: all six tables are
 * `ON DELETE RESTRICT`, so a resource that arrives inside the window fails the
 * delete instead of being destroyed with the organization. This count is what turns
 * the common case into a readable refusal naming what is in the way;
 * {@link rethrowAsOrganizationInUse} gives the raced one the same answer.
 */
export async function assertOrganizationOwnsNoResources(organizationId: string): Promise<void> {
  const counts = await db.execute<{ resource: string; total: number }>(
    sql.join(
      Object.values(OWNED_RESOURCE_TABLES).map(
        ({ table, plural }) =>
          sql`SELECT ${plural}::text AS "resource", count(*)::int AS "total"
              FROM ${table}
              WHERE ${table.organizationId} = ${organizationId}::uuid`,
      ),
      sql` UNION ALL `,
    ),
  );

  const byResource = new Map(counts.map((row) => [row.resource, row.total]));
  const held = Object.values(OWNED_RESOURCE_TABLES)
    .map(({ singular, plural }) => ({
      total: byResource.get(plural) ?? 0,
      singular,
      plural,
    }))
    .filter(({ total }) => total > 0);

  if (held.length === 0) return;

  const total = held.reduce((sum, { total: count }) => sum + count, 0);
  const breakdown = held
    .map(({ total: count, singular, plural }) => `${count} ${count === 1 ? singular : plural}`)
    .join(", ");

  throw new APIError("BAD_REQUEST", {
    message: `This organization still owns ${total} resource${
      total === 1 ? "" : "s"
    } (${breakdown}). Transfer or delete them first.`,
  });
}

/** Postgres `foreign_key_violation`. */
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Whether a thrown error is Postgres refusing to delete a row something still
 * references. Walked down the `cause` chain because both drizzle and Better Auth's
 * adapter re-wrap the driver error, so the code is rarely on the error itself.
 */
function isForeignKeyViolation(error: unknown): boolean {
  for (let current: unknown = error; typeof current === "object" && current !== null; ) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (String(code) === FOREIGN_KEY_VIOLATION) return true;
    current = cause;
  }
  return false;
}

/**
 * Re-raise a delete that lost the race as the refusal it would have got had the
 * count seen the resource: the constraint is the thing that actually protects the
 * work (see {@link assertOrganizationOwnsNoResources}), but on its own it surfaces as
 * a 500 with Postgres's own wording.
 *
 * The count runs again rather than being paraphrased, so the message names what is in
 * the way exactly as the pre-flight would have. If it comes back empty — the resource
 * moved on again after the failed delete — the caller simply retries and succeeds, so
 * the generic refusal is enough.
 */
export async function rethrowAsOrganizationInUse(
  organizationId: string,
  error: unknown,
): Promise<never> {
  if (!isForeignKeyViolation(error)) throw error;

  await assertOrganizationOwnsNoResources(organizationId);
  throw new APIError("BAD_REQUEST", {
    message: "This organization still owns resources. Transfer or delete them first.",
  });
}

/** Grants naming a grantee that no longer exists, by grantee type. */
function deleteGrantsFor(granteeType: "organization" | "team", condition: SQL) {
  return db
    .delete(resourceGrants)
    .where(and(eq(resourceGrants.granteeType, granteeType), condition));
}

/**
 * Drop the grants a deleted organization leaves behind. `resource_grants` is
 * polymorphic on the grantee side, so it carries no foreign key and nothing
 * cascades: the rows would otherwise survive as access nobody can see or revoke,
 * and could be re-associated with a future organization or team reusing the id.
 *
 * Two sets go: what the organization itself was granted on other organizations'
 * resources, and what its teams held. The teams are already gone by the time this
 * runs — they cascade with the organization — so they are found as team grants
 * whose team row no longer exists. That is exactly this organization's teams
 * (single-team deletes clean up after themselves below), and any older orphan it
 * sweeps up along the way was dead access too.
 */
export async function tearDownOrganizationGrants(organizationId: string): Promise<void> {
  await deleteGrantsFor("organization", eq(resourceGrants.granteeId, organizationId));
  await deleteGrantsFor(
    "team",
    sql`NOT EXISTS (
      SELECT 1 FROM ${teams} WHERE ${teams.id} = ${resourceGrants.granteeId}
    )`,
  );
}

/** The same teardown for a single team deleted on its own. */
export async function tearDownTeamGrants(teamId: string): Promise<void> {
  await deleteGrantsFor("team", eq(resourceGrants.granteeId, teamId));
}
