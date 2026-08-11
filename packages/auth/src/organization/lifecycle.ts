import { APIError } from "better-auth/api";

import {
  and,
  db,
  eq,
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
 * nothing here ever cascades, because a device owns a live AWS Thing and
 * certificate that only its own delete path can tear down.
 *
 * A total `Record` over the grant enum, not a list: a sixth org-owning resource
 * type has to appear here or this file stops compiling. Missed from a plain array
 * it would slip past the block silently and then be cascade-deleted with the
 * organization, which is the one outcome this rule exists to prevent.
 */
const OWNED_RESOURCE_TABLES = {
  experiment: { table: experiments, singular: "experiment", plural: "experiments" },
  macro: { table: macros, singular: "macro", plural: "macros" },
  protocol: { table: protocols, singular: "protocol", plural: "protocols" },
  workbook: { table: workbooks, singular: "workbook", plural: "workbooks" },
  device: { table: iotDevices, singular: "device", plural: "devices" },
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
 * before the row goes. A device lands on `RESTRICT` and fails the delete; the other
 * four cascade, so they are destroyed with the organization. For a create that is
 * tolerable — the resource was born in an organization on its way out. For a
 * **transfer in** it is not: a resource that existed elsewhere is lost.
 *
 * Known and open, because there is no lock that closes it from here. Better Auth
 * calls this hook *before* `adapter.deleteOrganization`, which opens its own
 * transaction, and hands the hook no adapter or transaction handle — so a
 * `FOR UPDATE` taken here commits and releases before the delete begins, and cannot
 * order the count against a writer. Closing it needs the count to run inside Better
 * Auth's delete transaction, which the plugin does not expose.
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
