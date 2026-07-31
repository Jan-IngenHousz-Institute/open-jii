import type {
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import {
  and,
  ensureDirectAdminGrant,
  eq,
  experiments,
  inArray,
  iotDevices,
  isNotNull,
  macros,
  organizationMembers,
  profiles,
  protocols,
  resourceGrants,
  sql,
  STAFFING_GRANT_ROLES,
  users,
  workbooks,
} from "@repo/database";
import type { AnyColumn, DbOrTx, SQL } from "@repo/database";

import { AppError } from "../common/utils/fp-utils";

/** Whether a grant role staffs a resource (confers full control). */
export function isStaffingRole(role: string): boolean {
  return (STAFFING_GRANT_ROLES as readonly string[]).includes(role);
}

/** A table the staffing rules can read an id and an owning organization from. */
type StaffedResourceTable =
  | typeof experiments
  | typeof macros
  | typeof protocols
  | typeof workbooks
  | typeof iotDevices;

/**
 * Where each staffed type keeps its id and owning organization.
 *
 * **The single enumeration of the types the staffing rules govern.** Everything
 * else derives from it: `owningOrgIdSql` reads a table out of it, and
 * {@link ALL_STAFFED_RESOURCES} — which is what the account-deletion blocker
 * actually queries — is built from it. Typed as a total `Record` over
 * `SharingResourceType` deliberately: a type added to the sharing enum then fails
 * to compile until it appears here, which is the only mechanism that stops a new
 * shareable type from being silently exempt from the deletion blocker while every
 * spec stays green.
 *
 * Devices are governed on exactly the same terms as the rest — a device whose
 * owning org has no living owner keeps its last direct admin, and being that last
 * answerable person blocks account deletion until the device is handed over or
 * deleted. That is the point rather than an edge case: a device nobody can
 * administer is live AWS infrastructure (a Thing, a certificate, an ingest topic)
 * that nobody can tear down.
 */
const STAFFED_RESOURCE_TABLES: Record<SharingResourceType, StaffedResourceTable> = {
  experiment: experiments,
  macro: macros,
  protocol: protocols,
  workbook: workbooks,
  device: iotDevices,
};

/**
 * Every staffed resource with its type and owning organization, as one
 * polymorphic row set — the account-deletion blocker's `FROM`.
 *
 * Generated from {@link STAFFED_RESOURCE_TABLES} rather than written out, so the
 * set of tables the blocker sweeps cannot drift from the set the last-admin
 * invariant governs. Hand-written, the two agreed only by discipline: a sixth type
 * added to the map but not to the SQL would keep its last-admin protection and
 * silently never block an account deletion, with nothing failing.
 *
 * Every branch names its own output columns instead of leaning on the first
 * branch's, so the column names do not depend on object key order.
 */
export const ALL_STAFFED_RESOURCES: SQL = sql.join(
  Object.entries(STAFFED_RESOURCE_TABLES).map(
    ([resourceType, table]) =>
      sql`SELECT ${resourceType}::"resource_type" AS "resource_type",
                 ${table.id} AS "id",
                 ${table.organizationId} AS "organization_id"
          FROM ${table}`,
  ),
  sql` UNION ALL `,
);

/**
 * The organization role that makes someone answerable for everything the org owns.
 * Deliberately just `owner`, not `admin`: an org admin has full *access* through
 * the access matrix, but ownership is the thing that cannot be taken away by
 * another member, so it is what the staffing and deletion rules hang on. Today
 * every org is a personal org with exactly one owner, so the two coincide.
 */
const ORG_OWNER_ROLE = "owner";

/**
 * The organization roles that already carry every action on everything the org
 * owns. Both are full control in the access matrix, so a per-resource grant on top
 * of either raises nothing.
 */
const ORG_FULL_CONTROL_ROLES = ["owner", "admin"] as const;

/** Refusal when a closed account's in-flight request tries to create something. */
export const CLOSED_ACCOUNT_CREATE_MESSAGE =
  "Cannot create resources with a closed account. Please sign in again.";

/**
 * Exactly the characters `String.prototype.trim()` strips: ECMAScript's
 * `WhiteSpace` (tab, vertical tab, form feed, space, NBSP, zero-width no-break
 * space, and the Unicode `Space_Separator` category) plus `LineTerminator` (LF,
 * CR, line separator, paragraph separator).
 *
 * Built as an explicit set rather than a `\s` class because neither language's
 * `\s` covers the same characters as the other's — and this predicate's whole
 * purpose is to agree with the JavaScript evaluator character for character.
 *
 * **U+0085 (NEL) is deliberately absent.** It looks like it belongs, but it is a
 * `Cc` control rather than a space separator and `trim()` leaves it in place —
 * verified, not assumed. Trimming it here would make SQL read `"owner<NEL>"` as
 * the owner role while `can()` does not, which is the same divergence this
 * fragment exists to remove, pointing the more dangerous way.
 */
const ECMASCRIPT_WHITESPACE = [
  "\u0020", // space
  "\u0009", // tab
  "\u000A", // line feed
  "\u000B", // vertical tab
  "\u000C", // form feed
  "\u000D", // carriage return
  "\u00A0", // no-break space
  "\u1680", // ogham space mark
  // U+2000-U+200A, the run of Unicode general-purpose spaces.
  ...Array.from({ length: 11 }, (_, i) => String.fromCharCode(0x2000 + i)),
  "\u2028", // line separator
  "\u2029", // paragraph separator
  "\u202F", // narrow no-break space
  "\u205F", // medium mathematical space
  "\u3000", // ideographic space
  "\uFEFF", // zero-width no-break space
].join("");

/**
 * Match a role token inside `organization_members.role`.
 *
 * That column holds Better Auth's role string, which may carry **several
 * comma-separated roles** (`"member,admin"`). The canonical evaluator splits on
 * commas, trims, and accepts the row if *any* token grants — so a SQL predicate
 * using string equality silently disagrees with it: a `member,owner` membership
 * would be neither locked, nor counted as an owner, nor caught by the deletion
 * blocker, while `can()` treats that person as an owner throughout.
 *
 * Every SQL-side ownership question goes through this one fragment, so none of
 * them can drift from the matrix or from each other.
 */
function orgRoleIncludes(roleRef: SQL | AnyColumn, roles: readonly string[]): SQL {
  const tokens = roles.map((role) => sql`${role}`).reduce((list, token) => sql`${list}, ${token}`);
  // Trimmed at the token boundaries only, never inside a token: stripping every
  // space would read "ad min" as `admin`, which the evaluator denies. An empty
  // token trims to '' and matches no role name, which is `.filter(Boolean)`'s
  // effect.
  return sql`EXISTS (
    SELECT 1 FROM unnest(string_to_array(${roleRef}, ',')) AS role_token
    WHERE trim(both ${ECMASCRIPT_WHITESPACE} from role_token) = ANY(ARRAY[${tokens}]::text[])
  )`;
}

/** {@link orgRoleIncludes} for callers writing raw SQL against their own alias. */
export function orgRoleIsOwnerSql(roleRef: SQL): SQL {
  return orgRoleIncludes(roleRef, [ORG_OWNER_ROLE]);
}

/**
 * Take a **shared** lock on a user's own row, as the anchor that orders anything
 * depending on whether that account is still open against its deletion.
 *
 * `users` rather than `profiles` deliberately: the row always exists, including
 * for an account that signed up but never onboarded, so it is the only anchor that
 * works for every account. A profile row can be absent exactly when it matters.
 *
 * Shared, not exclusive: concurrent creates by the same person must not queue
 * behind each other — only the deletion, which takes it exclusively, has to block
 * them. {@link seedCreatorControl} takes this **before** the organization lock, and
 * the deletion guard takes it first too, so the two always acquire in the same
 * order (user → organization → grants) and cannot form a cycle.
 */
export async function lockUserAccount(
  tx: DbOrTx,
  userId: string,
  mode: "share" | "update" = "share",
): Promise<void> {
  await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for(mode === "share" ? "share" : "update");
}

/**
 * Whether an account is still open. Mirrors {@link livingOrgOwnerIdsSql}'s rule
 * from the other direction: closure stamps `profiles.deleted_at`, which deletion
 * writes even when there was no profile to stamp, so a missing row means somebody
 * mid-onboarding rather than somebody gone.
 */
export async function isLivingUser(tx: DbOrTx, userId: string): Promise<boolean> {
  const closed = await tx
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.userId, userId), isNotNull(profiles.deletedAt)))
    .limit(1);

  return closed.length === 0;
}

/**
 * Whether `userId`'s role in `organizationId` already confers full control over
 * what that organization owns.
 *
 * This is what decides whether a creator needs a grant at all. Creating into your
 * own workspace — or into an organization you administer — needs none: the org
 * role already covers reading, updating, sharing and managing, and grants only
 * ever raise access. Creating into an organization you are merely a `member` of is
 * the opposite case: `member` is read-only, so without a grant you would be unable
 * to update, share or manage the thing you just made.
 *
 * The same principle the `0041` cleanup encodes, applied at write time instead of
 * to historical rows: a grant is seeded exactly when it is not redundant.
 */
export async function orgRoleConfersFullControl(
  tx: DbOrTx,
  organizationId: string | null,
  userId: string,
): Promise<boolean> {
  // No owning organization means no org role to inherit anything from.
  if (!organizationId) return false;

  const rows = await tx
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        orgRoleIncludes(organizationMembers.role, ORG_FULL_CONTROL_ROLES),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Take `SELECT … FOR UPDATE` on an organization's owner-membership rows.
 *
 * These rows are the **stable anchor** every "is anyone answerable for this?"
 * decision serializes on. Grant rows cannot serve that purpose: an owner-only
 * resource has none, so locking them locks nothing and two transactions each
 * conclude the other's owner will still be there. The membership rows exist
 * whether or not anything has been shared, which is exactly what makes them
 * lockable.
 *
 * Taken by resource creation and by account deletion alike — see
 * {@link seedCreatorControl} and the deletion guard.
 */
export async function lockOrgOwnerships(tx: DbOrTx, organizationId: string | null): Promise<void> {
  if (!organizationId) return;

  await tx
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        orgRoleIncludes(organizationMembers.role, [ORG_OWNER_ROLE]),
      ),
    )
    // A fixed order within the organization, so two transactions locking the same
    // owner set cannot take the rows in opposite orders and deadlock.
    .orderBy(organizationMembers.id)
    .for("update");
}

/** Whether an organization has at least one living owner. */
export async function orgHasLivingOwner(
  tx: DbOrTx,
  organizationId: string | null,
): Promise<boolean> {
  if (!organizationId) return false;

  const rows = await tx.execute<{ user_id: string }>(
    livingOrgOwnerIdsSql(sql`${organizationId}::uuid`),
  );
  return rows.length > 0;
}

/**
 * Make sure the creator ends up in control of what they just created, seeding
 * their own `admin` grant **only when something else does not already guarantee
 * it**.
 *
 * The usual case seeds nothing. Creating into your own workspace makes you its
 * owner, and an owner holds every action already; a grant would be pure
 * bookkeeping, and would render you as a collaborator on your own resource beside
 * the Owner row.
 *
 * Two cases do need the grant:
 *
 * 1. **Creating into an organization you are a plain `member` of.** Membership is
 *    enough to create there, but `member` is read-only — without the grant you
 *    could not update, share or manage the resource you just made, nor contribute
 *    data to an experiment you just opened.
 * 2. **The organization has no living owner.** Either it never had one on record
 *    (a resource with no owning org) or its last owner's account closed. Nobody
 *    inherits control here, so the resource would be born unstaffed.
 *
 * Case 2 is also what closes the race against an owner deleting their account
 * while a create is in flight. The owner-membership rows are locked **first**, so
 * this and the deletion guard cannot both look at a world where the other has not
 * happened yet. If the deletion commits first, the ownership re-read here sees the
 * husk and seeds the grant, so the new resource still has somebody in control. If
 * this commits first, the deletion's own re-check — behind the same lock — finds
 * the new resource and refuses. Either order leaves the invariant intact.
 *
 * Runs in the caller's transaction so the resource and the grant land together.
 */
export async function seedCreatorControl(
  tx: DbOrTx,
  resourceType: SharingResourceType,
  resourceId: string,
  organizationId: string | null,
  userId: string,
): Promise<void> {
  // User first, then organization: the deletion guard acquires in the same order,
  // which is what keeps the two from deadlocking.
  await lockUserAccount(tx, userId);
  await lockOrgOwnerships(tx, organizationId);

  if (
    (await orgHasLivingOwner(tx, organizationId)) &&
    (await orgRoleConfersFullControl(tx, organizationId, userId))
  ) {
    return;
  }

  // Every seed is gated on the creator still being here, not just the husk one. A
  // grant to a closed account is dead weight in the best case — nobody can act on
  // it — and unreachable garbage in the worst: the deletion that closed the account
  // tore down its grants *before* this one existed, so nothing will ever clean it
  // up. Reading this behind the shared lock above is what makes the answer stable:
  // a deletion either committed before it (seen here, refused) or is queued behind
  // it (and will sweep the grant up when it runs).
  if (!(await isLivingUser(tx, userId))) {
    throw AppError.forbidden(CLOSED_ACCOUNT_CREATE_MESSAGE);
  }

  await ensureDirectAdminGrant(tx, {
    resourceType,
    resourceId,
    userId,
    createdBy: userId,
  });
}

/**
 * The living owners of an organization, as a self-contained `SELECT`.
 *
 * **The single definition of who is answerable for what an organization owns.**
 * The staffing invariant's skip, both account-deletion prongs, the collaborators
 * surface's Owner rows and the join-request notifications all derive from this one
 * fragment, so they cannot drift into disagreeing about who counts as an owner.
 *
 * "Living" means the account has not been closed. Closure stamps
 * `profiles.deleted_at`; `users` carries no soft-delete column of its own, so that
 * stamp is the marker. The profile is joined **LEFT, deliberately**: the personal
 * organization is provisioned at sign-up, before the profile row exists, so an
 * owner who has not finished onboarding has no profile at all and must still count
 * as a living person answerable for their work. An inner join would quietly
 * declare every pre-onboarding owner dead and drop their resources into the
 * husk-org rules — unstaffing them and blocking sharing writes on them.
 *
 * @param organizationId SQL resolving to the organization id to scope to. A NULL
 *   here (a resource predating the org backfill) matches nothing, which is the
 *   conservative answer: it is treated exactly like a husk org.
 */
export function livingOrgOwnerIdsSql(organizationId: SQL): SQL {
  return sql`
    SELECT ${organizationMembers.userId} AS "user_id"
    FROM ${organizationMembers}
    LEFT JOIN ${profiles} ON ${profiles.userId} = ${organizationMembers.userId}
    WHERE ${organizationMembers.organizationId} = ${organizationId}
      AND ${orgRoleIncludes(organizationMembers.role, [ORG_OWNER_ROLE])}
      AND ${profiles.deletedAt} IS NULL
  `;
}

/** The owning organization of a resource, as a scalar subquery. */
function owningOrgIdSql(resourceType: SharingResourceType, resourceId: string): SQL {
  const table = STAFFED_RESOURCE_TABLES[resourceType];
  return sql`(SELECT ${table.organizationId} FROM ${table} WHERE ${table.id} = ${resourceId})`;
}

/**
 * The **living owners of the organization that owns a resource** — the people
 * answerable for it. This is where answerability comes from: a creator holds no
 * grant on what they create when owning the resource already confers full control
 * through the org role, because a grant could only ever repeat that.
 */
export async function findOwningOrgOwnerIds(
  tx: DbOrTx,
  resourceType: SharingResourceType,
  resourceId: string,
): Promise<string[]> {
  const rows = await tx.execute<{ user_id: string }>(
    livingOrgOwnerIdsSql(owningOrgIdSql(resourceType, resourceId)),
  );
  return rows.map((r) => r.user_id);
}

/** Whether anybody living owns the organization this resource belongs to. */
export async function hasLivingOwningOrgOwner(
  tx: DbOrTx,
  resourceType: SharingResourceType,
  resourceId: string,
): Promise<boolean> {
  const owners = await findOwningOrgOwnerIds(tx, resourceType, resourceId);
  return owners.length > 0;
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

/**
 * Whether the holder of a user grant can actually administer with it: an
 * `activated` account that has not been closed.
 *
 * **The single definition of an answerable grantee**, shared by the staffing
 * invariant and the account-deletion blocker's escape hatch. The two answer the
 * same question from opposite ends — "is anyone left who can administer this?" —
 * and had drifted: the blocker required activation while the staffing count took
 * any admin-tier grant row. Invitation acceptance seeds grants at registration,
 * *before* onboarding writes the profile, so on a husk-org resource a
 * never-onboarded grantee padded the staffing count and let the last real admin
 * walk away from a resource nobody could then administer.
 *
 * A missing `profiles` row therefore reads as "cannot administer", which is the
 * opposite of {@link livingOrgOwnerIdsSql}'s LEFT JOIN — deliberately. That one
 * answers who *owns* an organization, and a pre-onboarding owner is a real person
 * answerable for their work; this one answers who can act through a *grant*, and
 * an account that has not been activated can act through nothing.
 *
 * Written as an `EXISTS` subquery rather than a join so a caller can add it to a
 * `SELECT … FOR UPDATE` without widening what gets locked.
 */
export function granteeCanAdministerSql(granteeIdRef: SQL | AnyColumn): SQL<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${profiles}
    WHERE ${profiles.userId} = ${granteeIdRef}
      AND ${profiles.activated} = true
      AND ${profiles.deletedAt} IS NULL
  )`;
}

/** One staffing-tier grant row, as the invariant sees it. */
export interface StaffingGrantRow {
  id: string;
  granteeType: string;
  granteeId: string;
  /** Whether this row's holder can administer at all — see {@link granteeCanAdministerSql}. */
  canAdminister: boolean;
}

/**
 * The single definition of "the rows that could staff a resource" (user grants
 * with an admin/owner role), read with `SELECT … FOR UPDATE` so concurrent
 * staffing reductions serialize instead of both committing. Must run inside a
 * transaction — outside one the lock is released immediately and buys nothing.
 *
 * Every admin-tier row is returned and locked, including those whose holder cannot
 * administer: whether a row *counts* is {@link assertResourceStaysStaffed}'s
 * question, but a caller still has to find — and lock — the row it is about to
 * write. `canAdminister` rides along as a scalar subquery precisely so this stays
 * one table in the `FROM`, and `FOR UPDATE` therefore still locks nothing but the
 * grant rows.
 */
export async function lockStaffingGrants(
  tx: DbOrTx,
  resourceType: SharingResourceType,
  resourceId: string,
): Promise<StaffingGrantRow[]> {
  return tx
    .select({
      id: resourceGrants.id,
      granteeType: resourceGrants.granteeType,
      granteeId: resourceGrants.granteeId,
      canAdminister: granteeCanAdministerSql(resourceGrants.granteeId).mapWith(Boolean),
    })
    .from(resourceGrants)
    .where(
      and(
        eq(resourceGrants.resourceType, resourceType),
        eq(resourceGrants.resourceId, resourceId),
        eq(resourceGrants.granteeType, "user"),
        inArray(resourceGrants.role, [...STAFFING_GRANT_ROLES]),
      ),
    )
    .for("update");
}

/**
 * The **last-admin invariant**, in the only case where it still bites: a resource
 * whose owning organization has no living owner must not lose its last user grant
 * with an admin/owner role *that somebody can actually administer with*, so
 * revoking or demoting it is refused (400).
 *
 * While a living org owner exists there is already somebody answerable for the
 * resource with full control, so grants are freely revocable — including the last
 * admin one. Collaborators are collaborators; the owner is not one of them and
 * cannot be removed through this surface at all. The invariant only guards the
 * husk case (the owning org's last owner closed their account, or the resource has
 * no owning org), where the admin grants are the only thing left.
 *
 * The lock is taken **before** the owner check, and that order is load-bearing: it
 * is what serializes this write against a concurrent account deletion of the org's
 * last owner. Checking ownership first and skipping the lock would let a revoke
 * (owner still alive) and that owner's deletion (another admin grant still
 * present) both observe a safe world and both commit, leaving the resource with
 * neither. Taking the lock first means the second transaction re-reads ownership
 * after the first commits and sees the husk.
 *
 * Team/org grants never count as staffing — a named person has to be answerable.
 * Nor does a grant its holder cannot administer with: the count is over
 * {@link granteeCanAdministerSql}, the same rule the deletion blocker applies, so
 * a never-onboarded or deactivated grantee cannot stand in for the last admin.
 * Must run in the same transaction as the write it guards.
 */
export async function assertResourceStaysStaffed(
  tx: DbOrTx,
  { resourceType, resourceId, target, nextRole }: StaffingGuardedWrite,
): Promise<void> {
  // Keeping or raising the tier can never unstaff the resource, so there is
  // nothing to lock or count.
  if (nextRole !== null && isStaffingRole(nextRole)) return;

  const staffing = await lockStaffingGrants(tx, resourceType, resourceId);

  // Matched against every admin-tier row, answerable or not: this is about which
  // row the write is aimed at, not about whether it counts.
  const targetGrant = staffing.find((g) =>
    target.by === "grant"
      ? g.id === target.grantId
      : g.granteeType === target.granteeType && g.granteeId === target.granteeId,
  );

  // The grant being written doesn't staff the resource, so the count is unaffected.
  if (!targetGrant) return;

  // Somebody living owns this resource independently of any grant.
  if (await hasLivingOwningOrgOwner(tx, resourceType, resourceId)) return;

  // Taking away a grant nobody could act on cannot leave the resource any less
  // administered than it already is.
  if (!targetGrant.canAdminister) return;

  if (staffing.filter((g) => g.canAdminister).length <= 1) {
    throw AppError.badRequest(
      nextRole === null
        ? `Cannot remove the last admin from the ${resourceType}`
        : `Cannot demote the last admin of the ${resourceType}`,
    );
  }
}
