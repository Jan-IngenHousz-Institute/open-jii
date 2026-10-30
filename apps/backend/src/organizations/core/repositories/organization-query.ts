import { alias, and, eq, exists, organizations } from "@repo/database";
import type { AnyColumn, DbOrTx } from "@repo/database";

// Aliased so the probe still correlates when the outer query reads `organizations` itself.
const demoOrganizations = alias(organizations, "demo_organizations");

export function demoOrganizationCondition(database: DbOrTx, organizationId: AnyColumn) {
  return exists(
    database
      .select()
      .from(demoOrganizations)
      .where(and(eq(demoOrganizations.id, organizationId), eq(demoOrganizations.type, "demo"))),
  );
}
