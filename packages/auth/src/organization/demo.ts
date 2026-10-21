import { APIError } from "better-auth/api";

import { db, eq, organizations, sql } from "@repo/database";

import { configuredAdminUserIds, isPlatformAdmin } from "../platform-admin";

export async function resolveDemoOrganizationUpdate(
  update: { type?: unknown; visibility?: unknown },
  user: { id: string },
  organizationId?: string,
  adminIds: readonly string[] = configuredAdminUserIds,
): Promise<{ visibility?: "public" }> {
  const rows = organizationId
    ? await db
        .select({ type: organizations.type, visibility: organizations.visibility })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
    : [];
  const wasDemo = rows.length > 0 && rows[0].type === "demo";
  const becomesDemo = update.type === undefined ? wasDemo : update.type === "demo";
  if (
    update.type !== undefined &&
    (wasDemo || becomesDemo) &&
    !(await isPlatformAdmin(user, undefined, adminIds))
  ) {
    throw new APIError("FORBIDDEN", { message: "Only a platform admin can set or remove Demo" });
  }
  if (!becomesDemo) return {};
  if (update.visibility !== undefined && update.visibility !== "public") {
    throw new APIError("BAD_REQUEST", { message: "Demo organizations must be public" });
  }
  if (organizationId && !wasDemo) {
    const [row] = await db.execute<{ private: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM experiments WHERE organization_id = ${organizationId}::uuid AND visibility = 'private'
        UNION ALL SELECT 1 FROM workbooks WHERE organization_id = ${organizationId}::uuid AND visibility = 'private'
        UNION ALL SELECT 1 FROM protocols WHERE organization_id = ${organizationId}::uuid AND visibility = 'private'
        UNION ALL SELECT 1 FROM macros WHERE organization_id = ${organizationId}::uuid AND visibility = 'private'
      ) AS private
    `);
    if (row.private) {
      throw new APIError("BAD_REQUEST", {
        message: "Publish every experiment, workbook, protocol and macro before choosing Demo",
        code: "DEMO_PRIVATE_RESOURCES",
      });
    }
  }
  return { visibility: "public" };
}
