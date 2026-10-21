import { and, eq, exists, organizations } from "@repo/database";
import type { AnyColumn, DbOrTx } from "@repo/database";

export function demoOrganizationCondition(database: DbOrTx, organizationId: AnyColumn) {
  return exists(
    database
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, organizationId), eq(organizations.type, "demo"))),
  );
}
