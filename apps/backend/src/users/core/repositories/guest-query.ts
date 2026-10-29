import { and, eq, exists, sql, users } from "@repo/database";
import type { AnyColumn, DbOrTx, SQL } from "@repo/database";

import { demoOrganizationCondition } from "../../../organizations/core/repositories/organization-query";

export function guestCondition(database: DbOrTx, userId: string) {
  return exists(
    database
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isAnonymous, true))),
  ).mapWith(Boolean);
}

/**
 * A guest is a `member` of every Demo organization and of nothing else, and holds no
 * membership rows: readers that test membership rows add this as an arm beside them.
 * Rosters and member counts stay row-based, so guests are never listed as members.
 */
export function guestMemberCondition(
  database: DbOrTx,
  userId: string,
  organizationId: AnyColumn,
): SQL<boolean> {
  return (
    and(guestCondition(database, userId), demoOrganizationCondition(database, organizationId)) ??
    sql<boolean>`false`
  ).mapWith(Boolean);
}
