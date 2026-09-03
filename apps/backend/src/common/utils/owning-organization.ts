import { PERSONAL_ORG_SLUG_PREFIX, organizations, sql } from "@repo/database";
import type { SQL } from "@repo/database";

/**
 * The display name of the organization owning a row, or `NULL` when that
 * organization is a personal workspace.
 *
 * A personal workspace deliberately answers `NULL` rather than its generated name:
 * that name is not one anybody chose, personal workspaces are invisible across the
 * whole organization surface, and the resource pages already have a word for this
 * case. Collapsing it here means no reader has to know the slug rule.
 *
 * A correlated subquery rather than a join, so a detail query keeps returning exactly
 * one row whatever the ownership is, and so adding it to a query cannot change the
 * rows it already returned. The outer column is qualified explicitly: Drizzle only
 * table-qualifies columns inside a raw `sql` fragment when the surrounding query has
 * joins, and an unqualified name would otherwise bind to `organizations` itself and
 * silently resolve to nothing.
 */
export function owningOrganizationNameSql(
  table: string,
  column = "organization_id",
): SQL<string | null> {
  return sql<string | null>`(
    SELECT ${organizations.name} FROM ${organizations}
    WHERE ${organizations.id} = ${sql.identifier(table)}.${sql.identifier(column)}
      AND ${organizations.slug} NOT LIKE ${`${PERSONAL_ORG_SLUG_PREFIX}%`}
  )`;
}
