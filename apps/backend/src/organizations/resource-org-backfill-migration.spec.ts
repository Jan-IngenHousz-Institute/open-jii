import {
  sql,
  eq,
  and,
  ensurePersonalOrganization,
  personalOrgSlug,
  organizations,
  experiments,
  experimentMembers,
  macros,
  protocols,
  workbooks,
  resourceGrants,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { TestHarness } from "../test/test-harness";

/**
 * These statements mirror the Phase 2 data backfill hand-written in
 * `packages/database/drizzle/0038_cheerful_lucky_pierre.sql` (own every resource
 * with its creator's personal org + seed per-resource grants). They are
 * duplicated here so the migration's data ops are locked by tests — update both
 * together if the migration changes.
 *
 * Owners resolve via the deterministic personal-org slug `personal-<created_by>`
 * provisioned in 0035. All statements are idempotent (IS NULL / ON CONFLICT DO
 * NOTHING).
 */
const OWN_EXPERIMENTS_SQL = sql`
  UPDATE "experiments" e
  SET "organization_id" = o."id"
  FROM "organizations" o
  WHERE o."slug" = 'personal-' || e."created_by"::text
    AND e."organization_id" IS NULL;
`;

const MIRROR_EXPERIMENT_MEMBERS_SQL = sql`
  INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role")
  SELECT 'experiment', em."experiment_id", 'user', em."user_id", em."role"::text
  FROM "experiment_members" em
  ON CONFLICT DO NOTHING;
`;

const OWN_MACROS_SQL = sql`
  UPDATE "macros" m
  SET "organization_id" = o."id"
  FROM "organizations" o
  WHERE o."slug" = 'personal-' || m."created_by"::text
    AND m."organization_id" IS NULL;
`;

const GRANT_MACRO_CREATORS_SQL = sql`
  INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
  SELECT 'macro', m."id", 'user', m."created_by", 'admin', m."created_by"
  FROM "macros" m
  ON CONFLICT DO NOTHING;
`;

const OWN_PROTOCOLS_SQL = sql`
  UPDATE "protocols" p
  SET "organization_id" = o."id"
  FROM "organizations" o
  WHERE o."slug" = 'personal-' || p."created_by"::text
    AND p."organization_id" IS NULL;
`;

const GRANT_PROTOCOL_CREATORS_SQL = sql`
  INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
  SELECT 'protocol', p."id", 'user', p."created_by", 'admin', p."created_by"
  FROM "protocols" p
  ON CONFLICT DO NOTHING;
`;

const OWN_WORKBOOKS_SQL = sql`
  UPDATE "workbooks" w
  SET "organization_id" = o."id"
  FROM "organizations" o
  WHERE o."slug" = 'personal-' || w."created_by"::text
    AND w."organization_id" IS NULL;
`;

const GRANT_WORKBOOK_CREATORS_SQL = sql`
  INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
  SELECT 'workbook', w."id", 'user', w."created_by", 'admin', w."created_by"
  FROM "workbooks" w
  ON CONFLICT DO NOTHING;
`;

async function runBackfill(db: DatabaseInstance): Promise<void> {
  await db.execute(OWN_EXPERIMENTS_SQL);
  await db.execute(MIRROR_EXPERIMENT_MEMBERS_SQL);
  await db.execute(OWN_MACROS_SQL);
  await db.execute(GRANT_MACRO_CREATORS_SQL);
  await db.execute(OWN_PROTOCOLS_SQL);
  await db.execute(GRANT_PROTOCOL_CREATORS_SQL);
  await db.execute(OWN_WORKBOOKS_SQL);
  await db.execute(GRANT_WORKBOOK_CREATORS_SQL);
}

describe("resource-org migration data ops (0038)", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function personalOrgId(userId: string): Promise<string> {
    const [org] = await testApp.database
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, personalOrgSlug(userId)));
    return org.id;
  }

  describe("experiments", () => {
    it("owns each experiment with the creator's personal org and mirrors experiment_members into grants (roles preserved)", async () => {
      const owner = await testApp.createTestUser({ name: "Exp Owner" });
      const collaborator = await testApp.createTestUser({ name: "Exp Collaborator" });
      const ownerOrgId = await ensurePersonalOrganization(testApp.database, { id: owner });
      await ensurePersonalOrganization(testApp.database, { id: collaborator });

      const [experiment] = await testApp.database
        .insert(experiments)
        .values({ name: `Exp ${crypto.randomUUID()}`, createdBy: owner })
        .returning();
      await testApp.database.insert(experimentMembers).values([
        { experimentId: experiment.id, userId: owner, role: "admin" },
        { experimentId: experiment.id, userId: collaborator, role: "member" },
      ]);

      await runBackfill(testApp.database);

      const [updated] = await testApp.database
        .select({ organizationId: experiments.organizationId })
        .from(experiments)
        .where(eq(experiments.id, experiment.id));
      expect(updated.organizationId).toBe(ownerOrgId);

      const grants = await testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
          ),
        );
      expect(grants).toHaveLength(2);
      const byUser = Object.fromEntries(grants.map((g) => [g.granteeId, g.role]));
      expect(byUser[owner]).toBe("admin");
      expect(byUser[collaborator]).toBe("member");
      expect(grants.every((g) => g.granteeType === "user")).toBe(true);
    });
  });

  describe("single-owner resources (macros / protocols / workbooks)", () => {
    it("owns each with the creator's personal org and grants the creator admin", async () => {
      const userId = await testApp.createTestUser({ name: "Owner Everything" });
      const orgId = await ensurePersonalOrganization(testApp.database, { id: userId });
      const tag = crypto.randomUUID();

      const [macro] = await testApp.database
        .insert(macros)
        .values({
          name: `Macro ${tag}`,
          filename: `${tag}.py`,
          language: "python",
          code: "cHk=",
          createdBy: userId,
        })
        .returning();
      const [protocol] = await testApp.database
        .insert(protocols)
        .values({
          name: `Protocol ${tag}`,
          code: { steps: [] },
          family: "multispeq",
          createdBy: userId,
        })
        .returning();
      const [workbook] = await testApp.database
        .insert(workbooks)
        .values({ name: `Workbook ${tag}`, createdBy: userId })
        .returning();

      await runBackfill(testApp.database);

      for (const [type, row] of [
        ["macro", macro],
        ["protocol", protocol],
        ["workbook", workbook],
      ] as const) {
        const table = type === "macro" ? macros : type === "protocol" ? protocols : workbooks;
        const [refreshed] = await testApp.database
          .select({ organizationId: table.organizationId })
          .from(table)
          .where(eq(table.id, row.id));
        expect(refreshed.organizationId).toBe(orgId);

        const grants = await testApp.database
          .select()
          .from(resourceGrants)
          .where(and(eq(resourceGrants.resourceType, type), eq(resourceGrants.resourceId, row.id)));
        expect(grants).toHaveLength(1);
        expect(grants[0]).toMatchObject({
          granteeType: "user",
          granteeId: userId,
          role: "admin",
          createdBy: userId,
        });
      }
    });
  });

  describe("edge cases", () => {
    it("is idempotent and leaves a resource org-less (but still granted) when its creator has no personal org", async () => {
      const owned = await testApp.createTestUser({ name: "Has Org" });
      await ensurePersonalOrganization(testApp.database, { id: owned });

      // A creator with no personal org (e.g. a user soft-deleted before 0035):
      // no `personal-<id>` org exists, so ownership can't be set — but the
      // creator grant is still recorded and can() stays safe.
      const orphan = await testApp.createTestUser({ name: "No Org", createProfile: false });

      const tag = crypto.randomUUID();
      const [ownedMacro] = await testApp.database
        .insert(macros)
        .values({
          name: `Owned ${tag}`,
          filename: `owned-${tag}.py`,
          language: "python",
          code: "cHk=",
          createdBy: owned,
        })
        .returning();
      const [orphanMacro] = await testApp.database
        .insert(macros)
        .values({
          name: `Orphan ${tag}`,
          filename: `orphan-${tag}.py`,
          language: "python",
          code: "cHk=",
          createdBy: orphan,
        })
        .returning();

      await runBackfill(testApp.database);
      // Second pass must be a no-op (ON CONFLICT DO NOTHING / IS NULL guards).
      await runBackfill(testApp.database);

      const [ownedRow] = await testApp.database
        .select({ organizationId: macros.organizationId })
        .from(macros)
        .where(eq(macros.id, ownedMacro.id));
      expect(ownedRow.organizationId).toBe(await personalOrgId(owned));

      const [orphanRow] = await testApp.database
        .select({ organizationId: macros.organizationId })
        .from(macros)
        .where(eq(macros.id, orphanMacro.id));
      expect(orphanRow.organizationId).toBeNull();

      // Exactly one grant per macro after two passes — including the orphan's.
      for (const id of [ownedMacro.id, orphanMacro.id]) {
        const grants = await testApp.database
          .select()
          .from(resourceGrants)
          .where(and(eq(resourceGrants.resourceType, "macro"), eq(resourceGrants.resourceId, id)));
        expect(grants).toHaveLength(1);
        expect(grants[0].role).toBe("admin");
      }
    });
  });
});
