import type {
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { and, eq, inArray, resourceGrants, STAFFING_GRANT_ROLES } from "@repo/database";
import type { DbOrTx } from "@repo/database";

import { AppError } from "../common/utils/fp-utils";

/** Whether a grant role staffs a resource (confers full control). */
export function isStaffingRole(role: string): boolean {
  return (STAFFING_GRANT_ROLES as readonly string[]).includes(role);
}

/**
 * Which grant a mutation is about to change. Update and revoke know the grant's
 * id; the create-upsert only knows the grantee it is (re-)sharing with,
 * and may be about to overwrite that grantee's existing role.
 */
export type StaffingTarget =
  | { by: "grant"; grantId: string }
  | { by: "grantee"; granteeType: SharingGranteeType; granteeId: string };

export interface StaffingGuardedWrite {
  resourceType: SharingResourceType;
  resourceId: string;
  target: StaffingTarget;
  /** The role the grant will carry afterwards; `null` for a revoke. */
  nextRole: string | null;
}

/** One staffing grant row, as the invariant sees it. */
export interface StaffingGrantRow {
  id: string;
  granteeType: string;
  granteeId: string;
}

/**
 * Read an experiment's staffing grants **and lock them for the rest of the
 * transaction** (`SELECT … FOR UPDATE`).
 *
 * The single definition of "the rows that staff an experiment": **user** grants
 * carrying a {@link STAFFING_GRANT_ROLES} role. Every guard that
 * needs to reason about whether an experiment would be left unstaffed goes through
 * here — the sharing write guard below, and the account-deletion guard — so the row
 * set cannot drift between them.
 *
 * The lock is the whole point: two transactions that both want to reduce the
 * staffing set contend on the same rows, so they serialize, and Postgres
 * re-evaluates the predicate after each lock acquisition. The second transaction
 * therefore observes the first one's committed effect instead of its own stale
 * snapshot.
 *
 * Must be called inside a transaction; outside one the lock is released
 * immediately and buys nothing.
 */
export async function lockStaffingGrants(
  tx: DbOrTx,
  experimentId: string,
): Promise<StaffingGrantRow[]> {
  return tx
    .select({
      id: resourceGrants.id,
      granteeType: resourceGrants.granteeType,
      granteeId: resourceGrants.granteeId,
    })
    .from(resourceGrants)
    .where(
      and(
        eq(resourceGrants.resourceType, "experiment"),
        eq(resourceGrants.resourceId, experimentId),
        eq(resourceGrants.granteeType, "user"),
        inArray(resourceGrants.role, [...STAFFING_GRANT_ROLES]),
      ),
    )
    .for("update");
}

/**
 * The **experiment last-admin invariant**.
 *
 * An experiment must never be left without a named person who can administer it,
 * so the last user grant with role `admin`/`owner` cannot be revoked or demoted.
 * Before the members→grants consolidation this lived in the member use-cases, keyed
 * off the roster role; the sharing module is now the only path by which an admin
 * tier can be given up, so the invariant belongs here.
 *
 * **Must be called inside the same transaction as the mutation it guards.** The
 * `SELECT … FOR UPDATE` is what makes the invariant hold under concurrency: two
 * simultaneous demotes would otherwise both read a count of 2 and both commit,
 * leaving zero admins. Locking the staffing rows serializes those transactions,
 * and Postgres re-evaluates the predicate after acquiring each lock, so the second
 * transaction sees the first one's effect rather than its stale snapshot.
 * `SharingRepository` funnels create/update/revoke through it — that is the only
 * way the sharing surface writes a grant, so no fourth path can quietly skip the
 * check.
 *
 * Scoped to experiments on purpose. Macros, protocols and workbooks have no such
 * rule — they are authored artifacts whose creator's org role is the backstop, and
 * an experiment is the thing that collects other people's field data.
 *
 * Team and organization grants deliberately do not count as staffing: "someone in
 * that org can administer it" is not an answerable owner, and org-lifecycle
 * semantics that would make it one land in Phase 4.
 *
 * @throws AppError (400) when the write would unstaff the experiment
 */
export async function assertExperimentStaysStaffed(
  tx: DbOrTx,
  { resourceType, resourceId, target, nextRole }: StaffingGuardedWrite,
): Promise<void> {
  if (resourceType !== "experiment") return;
  // Keeping or raising the tier can never unstaff the experiment, so there is
  // nothing to lock or count.
  if (nextRole !== null && isStaffingRole(nextRole)) return;

  const staffing = await lockStaffingGrants(tx, resourceId);

  const targetsStaffingGrant = staffing.some((g) =>
    target.by === "grant"
      ? g.id === target.grantId
      : g.granteeType === target.granteeType && g.granteeId === target.granteeId,
  );

  // The grant being written doesn't staff the experiment, so the count is unaffected.
  if (!targetsStaffingGrant) return;

  if (staffing.length <= 1) {
    throw AppError.badRequest(
      nextRole === null
        ? "Cannot remove the last admin from the experiment"
        : "Cannot demote the last admin of the experiment",
    );
  }
}
