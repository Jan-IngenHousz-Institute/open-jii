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
function isStaffingRole(role: string): boolean {
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
 * Where each staffed type keeps its id and owning organization — the single
 * enumeration of what the staffing rules govern; everything else derives from it.
 *
 * Typed as a total `Record` over `SharingResourceType` deliberately: a type added
 * to the sharing enum fails to compile until it appears here, which is what stops
 * a new shareable type from being silently exempt from the deletion blocker while
 * every spec stays green.
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
 * Generated from {@link STAFFED_RESOURCE_TABLES} so the tables the blocker sweeps
 * cannot drift from the ones the last-admin invariant governs. Every branch names
 * its own output columns, so they do not depend on object key order.
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
 * Deliberately just `owner`, not `admin`: an org admin has full *access*, but
 * ownership is what another member cannot take away, so the staffing and deletion
 * rules hang on it.
 */
const ORG_OWNER_ROLE = "owner";

/**
 * Org roles that already carry every action on what the org owns, so a
 * per-resource grant on top of either raises nothing.
 */
const ORG_FULL_CONTROL_ROLES = ["owner", "admin"] as const;

/** Refusal when a closed account's in-flight request tries to create something. */
const CLOSED_ACCOUNT_CREATE_MESSAGE =
  "Cannot create resources with a closed account. Please sign in again.";

/**
 * Exactly the characters `String.prototype.trim()` strips. Spelled out rather than
 * using `\s`, because Postgres' and JavaScript's `\s` cover different sets and this
 * has to agree with the JS evaluator character for character.
 *
 * U+0085 (NEL) is deliberately absent: it is a `Cc` control, not a space separator,
 * and `trim()` leaves it in place.
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
 * That column holds Better Auth's role string, which may carry several
 * comma-separated roles (`"member,admin"`), and the canonical evaluator accepts the
 * row if *any* token grants. String equality would silently disagree — a
 * `member,owner` membership would not count as an owner in SQL while `can()` treats
 * them as one. Every SQL-side ownership question goes through this one fragment.
 */
function orgRoleIncludes(roleRef: SQL | AnyColumn, roles: readonly string[]): SQL {
  const tokens = roles.map((role) => sql`${role}`).reduce((list, token) => sql`${list}, ${token}`);
  // Trimmed at the token boundaries only, never inside: stripping every space would
  // read "ad min" as `admin`, which the evaluator denies.
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
 * A **shared** lock on the user's own row, ordering anything that depends on the
 * account still being open against its deletion. `users` not `profiles` — that row
 * always exists. Shared so concurrent creates by one person do not queue; only the
 * deletion takes it exclusively. Everything acquires user → organization → grants,
 * so no cycle.
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
 * Whether an account is still open. Closure stamps `profiles.deleted_at` — deletion
 * inserts a tombstone row when there was no profile to stamp — so a missing row
 * means somebody mid-onboarding rather than somebody gone.
 */
async function isLivingUser(tx: DbOrTx, userId: string): Promise<boolean> {
  const closed = await tx
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.userId, userId), isNotNull(profiles.deletedAt)))
    .limit(1);

  return closed.length === 0;
}

/**
 * Whether `userId`'s role in `organizationId` already confers full control over
 * what that organization owns — which is what decides whether a creator needs a
 * grant at all. Creating into your own workspace, or into an org you administer,
 * needs none; creating into an org you are merely a `member` of does, since
 * `member` is read-only.
 */
async function orgRoleConfersFullControl(
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
 * Take `SELECT … FOR UPDATE` on an organization's owner-membership rows — the
 * anchor every "is anyone answerable for this?" decision serializes on, taken by
 * resource creation and account deletion alike.
 *
 * Grant rows cannot serve that purpose: an owner-only resource has none, so locking
 * them locks nothing and two transactions each conclude the other's owner will
 * still be there. Membership rows exist whether or not anything has been shared.
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
async function orgHasLivingOwner(tx: DbOrTx, organizationId: string | null): Promise<boolean> {
  if (!organizationId) return false;

  const rows = await tx.execute<{ user_id: string }>(
    livingOrgOwnerIdsSql(sql`${organizationId}::uuid`),
  );
  return rows.length > 0;
}

/**
 * Seed the creator an `admin` grant, but only when nothing else already guarantees
 * control. Your own workspace seeds nothing: an owner holds every action, and the
 * grant would render you a collaborator on your own resource. Two cases need it —
 * creating into an org you are a plain (read-only) `member` of, and an org with no
 * living owner, where the resource would be born unstaffed.
 *
 * Locking the owner rows first also settles the race against that owner deleting
 * their account mid-create: whoever commits second re-reads what the first left.
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

  // A grant to a closed account is unreachable garbage: the deletion that closed it
  // tore down its grants before this one existed, so nothing will ever collect it.
  // Reading this behind the shared lock above is what makes the answer stable.
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
 * The living owners of an organization — the single definition of who is answerable
 * for what it owns, shared by the staffing invariant, both deletion prongs, the
 * Owner rows and join-request notifications.
 *
 * The profile join is LEFT deliberately: personal orgs are provisioned at sign-up,
 * before the profile row exists, so an inner join would declare every
 * pre-onboarding owner dead. A NULL `organizationId` matches nothing, i.e. a husk.
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
 * The living owners of the organization that owns a resource — the people
 * answerable for it. A creator normally holds no grant on what they create, so this
 * rather than the grant table is where answerability comes from.
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
async function hasLivingOwningOrgOwner(
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
 * Whether a user grant's holder can administer with it: activated, not closed. One
 * definition, shared by the staffing invariant and the deletion blocker's escape
 * hatch so they cannot disagree.
 *
 * A missing profile reads as "cannot administer" — deliberately the opposite of
 * {@link livingOrgOwnerIdsSql}, since invitations seed grants before onboarding.
 * `EXISTS` not a join, so adding it to a `FOR UPDATE` widens no lock.
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
 * The rows that could staff a resource (admin/owner user grants), `FOR UPDATE` so
 * concurrent staffing reductions serialize. Must run in a transaction, or the lock
 * releases immediately. Every admin-tier row is locked, including holders who
 * cannot administer — whether a row *counts* is
 * {@link assertResourceStaysStaffed}'s question, but the caller still has to lock
 * what it is about to write. `canAdminister` is a scalar subquery so `FOR UPDATE`
 * locks nothing but the grants.
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
 * The **last-admin invariant**. Refuses (400) a revoke or demotion that would take
 * the last administrable admin/owner user grant off a resource whose owning org has
 * no living owner. Must run in the same transaction as the write it guards; while a
 * living owner exists somebody answerable already has full control, so only the
 * husk case is guarded.
 *
 * The lock comes **before** the owner check, and that order is load-bearing:
 * reversed, a revoke and that owner's deletion would both see a safe world and both
 * commit. Team/org grants never count — a named person has to be answerable.
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
