import {
  sql,
  eq,
  organizations,
  organizationMembers,
  profiles,
  sessions,
  personalOrgSlug,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";

/**
 * These statements mirror the data operations hand-written in
 * `packages/database/drizzle/0035_wild_moondragon.sql` (legacy-org
 * cleanup + personal-org provisioning). They are duplicated here so the
 * irreversible DELETE and the provisioning backfill are locked by tests —
 * update both together if the migration changes.
 */
const LEGACY_CLEANUP_SQL = sql`
  DELETE FROM "organizations" o
  WHERE o."slug" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "organization_members" m WHERE m."organization_id" = o."id");
`;

const PROVISION_ORGS_SQL = sql`
  INSERT INTO "organizations" ("name", "slug")
  SELECT
    CASE
      WHEN TRIM(p."first_name" || ' ' || p."last_name") <> ''
        THEN TRIM(p."first_name" || ' ' || p."last_name") || '''s workspace'
      ELSE 'Personal workspace'
    END,
    'personal-' || u."id"::text
  FROM "users" u
  JOIN "profiles" p ON p."user_id" = u."id"
  WHERE p."deleted_at" IS NULL
  ON CONFLICT ("slug") DO NOTHING;
`;

const PROVISION_MEMBERS_SQL = sql`
  INSERT INTO "organization_members" ("organization_id", "user_id", "role")
  SELECT o."id", u."id", 'owner'
  FROM "users" u
  JOIN "profiles" p ON p."user_id" = u."id"
  JOIN "organizations" o ON o."slug" = 'personal-' || u."id"::text
  WHERE p."deleted_at" IS NULL
  ON CONFLICT DO NOTHING;
`;

const PROVISION_SESSIONS_SQL = sql`
  UPDATE "sessions" s
  SET "active_organization_id" = o."id"
  FROM "organizations" o
  WHERE o."slug" = 'personal-' || s."user_id"::text
    AND s."active_organization_id" IS NULL;
`;

describe("personal-org migration data ops (0035)", () => {
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

  describe("legacy institution cleanup", () => {
    it("deletes only slug-less organizations that have no members", async () => {
      // (a) legacy institution row: no slug, no members -> must be deleted
      const [legacy] = await testApp.database
        .insert(organizations)
        .values({ name: "Old Institute" })
        .returning();

      // (b) slug-less but has a member -> must be kept (NOT EXISTS guard)
      const memberUserId = await testApp.createTestUser({ name: "Member Owner" });
      const [legacyWithMember] = await testApp.database
        .insert(organizations)
        .values({ name: "Legacy With Member" })
        .returning();
      await testApp.database
        .insert(organizationMembers)
        .values({ organizationId: legacyWithMember.id, userId: memberUserId, role: "owner" });

      // (c) proper Better Auth org with a slug -> must be kept
      const [proper] = await testApp.database
        .insert(organizations)
        .values({ name: "Proper Org", slug: "proper-org" })
        .returning();

      await testApp.database.execute(LEGACY_CLEANUP_SQL);

      const remaining = await testApp.database.select({ id: organizations.id }).from(organizations);
      const ids = remaining.map((r) => r.id);
      expect(ids).not.toContain(legacy.id);
      expect(ids).toContain(legacyWithMember.id);
      expect(ids).toContain(proper.id);
    });
  });

  describe("personal-org provisioning backfill", () => {
    it("provisions an owner-held org named from the profile, for active profiles only", async () => {
      const activeUserId = await testApp.createTestUser({ name: "Ada Lovelace" });

      // Soft-deleted profile -> must NOT be provisioned.
      const deletedUserId = await testApp.createTestUser({ name: "Ghost User" });
      await testApp.database
        .update(profiles)
        .set({ deletedAt: sql`now() AT TIME ZONE 'UTC'` })
        .where(eq(profiles.userId, deletedUserId));

      // No profile (registration not completed) -> must NOT be provisioned.
      const noProfileUserId = await testApp.createTestUser({ createProfile: false });

      await testApp.database.execute(PROVISION_ORGS_SQL);
      await testApp.database.execute(PROVISION_MEMBERS_SQL);

      const [org] = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.slug, personalOrgSlug(activeUserId)));
      expect(org).toBeDefined();
      expect(org.name).toBe("Ada Lovelace's workspace");

      const members = await testApp.database
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, org.id));
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe(activeUserId);
      expect(members[0].role).toBe("owner");

      const deletedOrg = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.slug, personalOrgSlug(deletedUserId)));
      expect(deletedOrg).toHaveLength(0);

      const noProfileOrg = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.slug, personalOrgSlug(noProfileUserId)));
      expect(noProfileOrg).toHaveLength(0);
    });

    it("is idempotent, backfills null active_organization_id, and preserves explicit active orgs", async () => {
      const userId = await testApp.createTestUser({ name: "Grace Hopper" });
      const [explicitOrg] = await testApp.database
        .insert(organizations)
        .values({ name: "Explicit Org", slug: `explicit-${userId}` })
        .returning();

      const nullSessionToken = `null-active-org-${userId}`;
      const explicitSessionToken = `explicit-active-org-${userId}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await testApp.database.insert(sessions).values([
        {
          userId,
          token: nullSessionToken,
          expiresAt,
        },
        {
          userId,
          token: explicitSessionToken,
          activeOrganizationId: explicitOrg.id,
          expiresAt,
        },
      ]);

      // Run twice — the second pass must be a no-op (no duplicate org/member).
      for (let i = 0; i < 2; i++) {
        await testApp.database.execute(PROVISION_ORGS_SQL);
        await testApp.database.execute(PROVISION_MEMBERS_SQL);
        await testApp.database.execute(PROVISION_SESSIONS_SQL);
      }

      const orgs = await testApp.database
        .select()
        .from(organizations)
        .where(eq(organizations.slug, personalOrgSlug(userId)));
      expect(orgs).toHaveLength(1);

      const members = await testApp.database
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, orgs[0].id));
      expect(members).toHaveLength(1);

      const [nullSession] = await testApp.database
        .select()
        .from(sessions)
        .where(eq(sessions.token, nullSessionToken));
      expect(nullSession.activeOrganizationId).toBe(orgs[0].id);

      const [explicitSession] = await testApp.database
        .select()
        .from(sessions)
        .where(eq(sessions.token, explicitSessionToken));
      expect(explicitSession.activeOrganizationId).toBe(explicitOrg.id);
    });
  });
});
