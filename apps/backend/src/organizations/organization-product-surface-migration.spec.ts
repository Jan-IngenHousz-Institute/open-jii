import {
  ensurePersonalOrganization,
  eq,
  experiments,
  invitations,
  organizationInvitations,
  organizationMembers,
  organizations,
  resourceGrants,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { TestHarness } from "../test/test-harness";

/**
 * These statements mirror the data migration hand-written in
 * `packages/database/drizzle/0042_iam_org_product_surface.sql`, the second release
 * of the grant-role rename: release 1 stopped writing `member` and started reading
 * `viewer`, and this rewrites the rows release 1 deliberately left alone. Duplicated
 * here so the migration's data ops are locked by tests — update both together.
 *
 * The vocabulary is the trap: only `resource_grants.role` and `invitations.role`
 * carry a *grant* role. `organization_members.role` and `organization_invitations.role`
 * carry Better Auth *organization* roles, where `member` is the current, correct
 * name — the specs below assert those two are untouched.
 */
const RENAME_GRANT_ROLE_SQL = sql`
  UPDATE "resource_grants" SET "role" = 'viewer' WHERE "role" = 'member';
`;

const RENAME_INVITATION_ROLE_SQL = sql`
  UPDATE "invitations" SET "role" = 'viewer' WHERE "role" = 'member';
`;

async function runDataMigration(db: DatabaseInstance): Promise<void> {
  await db.execute(RENAME_GRANT_ROLE_SQL);
  await db.execute(RENAME_INVITATION_ROLE_SQL);
}

describe("organization product surface migration data ops (0042)", () => {
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

  async function seedExperiment(owner: string) {
    const organizationId = await ensurePersonalOrganization(testApp.database, { id: owner });
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({ name: `Exp ${crypto.randomUUID()}`, createdBy: owner, organizationId })
      .returning();
    return experiment;
  }

  /** A grant and an invitation still spelling the read-and-contribute tier `member`. */
  async function seedRetiredSpelling() {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const subject = await testApp.createTestUser({ name: "Subject" });
    const experiment = await seedExperiment(owner);

    // Inserted directly: no typed write path can express the retired spelling.
    await testApp.database.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: subject,
      role: "member",
    });
    await testApp.database.insert(invitations).values({
      resourceType: "experiment",
      resourceId: experiment.id,
      email: `legacy-${crypto.randomUUID()}@example.com`,
      role: "member",
      invitedBy: owner,
    });

    return { owner, subject, experiment };
  }

  const storedRoles = (table: "resource_grants" | "invitations") =>
    testApp.database
      .execute<{ role: string }>(sql`SELECT "role" FROM ${sql.identifier(table)}`)
      .then((rows) => rows.map((r) => r.role));

  it("rewrites the retired grant spelling in both tables", async () => {
    await seedRetiredSpelling();

    await runDataMigration(testApp.database);

    // Same tier either way, so nobody's access moves — but only one name is left,
    // which is what makes a `WHERE role = 'viewer'` find every row of that tier.
    expect(await storedRoles("resource_grants")).toEqual(["viewer"]);
    expect(await storedRoles("invitations")).toEqual(["viewer"]);
  });

  it("leaves the current spellings alone", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const admin = await testApp.createTestUser({ name: "Admin" });
    const experiment = await seedExperiment(owner);
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: admin,
      role: "admin",
      createdBy: owner,
    });

    await runDataMigration(testApp.database);

    expect(await storedRoles("resource_grants")).toEqual(["admin"]);
  });

  it("does not touch the organization role of the same name", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const joiner = await testApp.createTestUser({ name: "Joiner" });
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, owner, "owner");
    await testApp.addOrganizationMember(organizationId, joiner, "member");
    await testApp.database.insert(organizationInvitations).values({
      organizationId,
      email: `invitee-${crypto.randomUUID()}@example.com`,
      role: "member",
      inviterId: owner,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    await runDataMigration(testApp.database);

    // `member` is the correct, current name for the lowest organization role. A
    // rename that reached these two columns would silently re-tier every member.
    const memberRoles = await testApp.database
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
    expect(memberRoles.map((r) => r.role).sort()).toEqual(["member", "owner"]);

    const invitationRoles = await testApp.database
      .select({ role: organizationInvitations.role })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, organizationId));
    expect(invitationRoles.map((r) => r.role)).toEqual(["member"]);
  });

  it("re-applies cleanly onto its own output", async () => {
    await seedRetiredSpelling();

    await runDataMigration(testApp.database);
    const afterFirst = {
      grants: await storedRoles("resource_grants"),
      invitations: await storedRoles("invitations"),
    };
    await runDataMigration(testApp.database);

    // Set-based and predicated on the value being rewritten, so a run interrupted
    // half-way can simply be run again.
    expect({
      grants: await storedRoles("resource_grants"),
      invitations: await storedRoles("invitations"),
    }).toEqual(afterFirst);
  });
});

/** The end state 0042 leaves behind, in the database rather than in the model. */
describe("organization product surface migration end state (0042)", () => {
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

  it("defaults invitations.role to viewer", async () => {
    const [column] = await testApp.database.execute<{ column_default: string | null }>(
      sql`SELECT column_default FROM information_schema.columns
          WHERE table_name = 'invitations' AND column_name = 'role'`,
    );
    expect(column.column_default).toBe("'viewer'::text");
  });

  it("gives every organization a private directory listing", async () => {
    const [column] = await testApp.database.execute<{
      column_default: string | null;
      is_nullable: string;
    }>(
      sql`SELECT column_default, is_nullable FROM information_schema.columns
          WHERE table_name = 'organizations' AND column_name = 'visibility'`,
    );
    // Existing organizations — personal workspaces included — land private, so the
    // migration never publishes anything into the directory by itself.
    expect(column).toMatchObject({ column_default: "'private'::visibility", is_nullable: "NO" });

    const organizationId = await testApp.createOrganization();
    const [org] = await testApp.database
      .select({ visibility: organizations.visibility })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    expect(org.visibility).toBe("private");
  });

  it("allows one pending join request per organization and user, and no more", async () => {
    const requester = await testApp.createTestUser({ name: "Requester" });
    const organizationId = await testApp.createOrganization();

    const insertPending = () =>
      testApp.database.execute(
        sql`INSERT INTO "organization_join_requests" ("organization_id", "user_id")
            VALUES (${organizationId}, ${requester})`,
      );

    await insertPending();
    await expect(insertPending()).rejects.toThrow();

    // Resolved rows are not deduped: a rejected request must not block a new one.
    await testApp.database.execute(
      sql`UPDATE "organization_join_requests" SET "status" = 'rejected'`,
    );
    await expect(insertPending()).resolves.toBeDefined();
  });

  it.each([
    ["invitations", "invitations_email_status_idx"],
    ["organization_invitations", "organization_invitations_email_status_idx"],
  ])("indexes %s on (email, status)", async (table, indexName) => {
    // Both are read on every sign-in by the auto-accept lookup, so an unindexed
    // scan here is a scan on the authentication path, not on an org screen.
    const [index] = await testApp.database.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE tablename = ${table} AND indexname = ${indexName}`,
    );
    expect(index.indexdef).toContain("(email, status)");
  });

  it.each([
    ["experiments", "experiments_organization_id_idx"],
    ["macros", "macros_organization_id_idx"],
    ["protocols", "protocols_organization_id_idx"],
    ["workbooks", "workbooks_organization_id_idx"],
  ])("indexes %s on organization_id", async (table, indexName) => {
    // The org overview counts each resource type, and the deletion blockers count
    // them again, with a correlated `COUNT(*) WHERE organization_id = $1` per table.
    // `iot_devices` was already indexed (0039); these four were the seq scans.
    const [index] = await testApp.database.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE tablename = ${table} AND indexname = ${indexName}`,
    );
    expect(index.indexdef).toContain("(organization_id)");
  });
});
