import {
  and,
  eq,
  ensurePersonalOrganization,
  experiments,
  experimentMembers,
  macros,
  protocols,
  resourceGrants,
  sql,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { TestHarness } from "../test/test-harness";

/**
 * These statements mirror the data migration hand-written in
 * `packages/database/drizzle/0041_iam_grants_sole_access_source.sql`, which makes
 * `resource_grants` the only thing that confers access to an experiment. They are
 * duplicated here so the migration's data ops are locked by tests — update both
 * together if the migration changes.
 *
 * The migration carries no DDL: `resource_grants` already had the right shape.
 * `experiment_members` is only ever READ, so the specs seed it to reproduce the
 * pre-consolidation state and then assert what the grants look like afterwards.
 */
const GRANT_EVERY_MEMBER_THEIR_ROLE_SQL = sql`
  INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role")
  SELECT 'experiment', em."experiment_id", 'user', em."user_id", em."role"::text
  FROM "experiment_members" em
  WHERE NOT EXISTS (
    SELECT 1 FROM "profiles" p
    WHERE p."user_id" = em."user_id"
      AND p."deleted_at" IS NOT NULL
  )
  ON CONFLICT DO NOTHING;
`;

const DELETE_CREATOR_SELF_GRANTS_SQL = sql`
  DELETE FROM "resource_grants"
  WHERE "resource_type" IN ('macro', 'protocol', 'workbook')
    AND "grantee_type" = 'user'
    AND "role" = 'admin'
    AND "grantee_id" = "created_by";
`;

async function runDataMigration(db: DatabaseInstance): Promise<void> {
  await db.execute(GRANT_EVERY_MEMBER_THEIR_ROLE_SQL);
  await db.execute(DELETE_CREATOR_SELF_GRANTS_SQL);
}

describe("grants-as-sole-access-source migration data ops (0041)", () => {
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

  function grantsFor(
    resourceType: "experiment" | "macro" | "protocol" | "workbook" | "device",
    id: string,
  ) {
    return testApp.database
      .select()
      .from(resourceGrants)
      .where(and(eq(resourceGrants.resourceType, resourceType), eq(resourceGrants.resourceId, id)));
  }

  async function seedExperiment(owner: string) {
    await ensurePersonalOrganization(testApp.database, { id: owner });
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({ name: `Exp ${crypto.randomUUID()}`, createdBy: owner })
      .returning();
    return experiment;
  }

  it.each(["member", "admin"] as const)(
    "grants a %s member the matching role when they hold no grant at all",
    async (role) => {
      const owner = await testApp.createTestUser({ name: "Owner" });
      const joiner = await testApp.createTestUser({ name: "Joiner" });
      const experiment = await seedExperiment(owner);
      // The shape invitation acceptance left behind: a roster row and no grant.
      // Without this migration that person loses access entirely.
      await testApp.database
        .insert(experimentMembers)
        .values({ experimentId: experiment.id, userId: joiner, role });

      await runDataMigration(testApp.database);

      expect(await grantsFor("experiment", experiment.id)).toEqual([
        expect.objectContaining({ granteeId: joiner, role, createdBy: null }),
      ]);
    },
  );

  it("leaves an existing grant alone rather than resetting it to the roster role", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    const experiment = await seedExperiment(owner);
    await testApp.database
      .insert(experimentMembers)
      .values({ experimentId: experiment.id, userId: collaborator, role: "admin" });
    // Whatever the roster says, the grant is the deliberate record of access — the
    // dormant roster must not get to overwrite it.
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: owner,
    });

    await runDataMigration(testApp.database);

    expect(await grantsFor("experiment", experiment.id)).toEqual([
      expect.objectContaining({ granteeId: collaborator, role: "viewer" }),
    ]);
  });

  it("skips a member whose account has been closed", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const closed = await testApp.createTestUser({ name: "Closed", deletedAt: new Date() });
    const experiment = await seedExperiment(owner);
    // Account deletion clears grants but a legacy roster row can outlive it;
    // reviving it as a grant would hand a closed account live access.
    await testApp.database
      .insert(experimentMembers)
      .values({ experimentId: experiment.id, userId: closed, role: "admin" });

    await runDataMigration(testApp.database);

    expect(await grantsFor("experiment", experiment.id)).toEqual([]);
  });

  it("deletes creator self-grants on macro/protocol/workbook but keeps every other grant", async () => {
    const creator = await testApp.createTestUser({ name: "Creator" });
    const other = await testApp.createTestUser({ name: "Other" });
    await ensurePersonalOrganization(testApp.database, { id: creator });
    const tag = crypto.randomUUID();

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `Macro ${tag}`,
        filename: `${tag}.py`,
        language: "python",
        code: "cHk=",
        createdBy: creator,
      })
      .returning();
    const [protocol] = await testApp.database
      .insert(protocols)
      .values({
        name: `Protocol ${tag}`,
        code: { steps: [] },
        family: "multispeq",
        createdBy: creator,
      })
      .returning();
    const [workbook] = await testApp.database
      .insert(workbooks)
      .values({ name: `Workbook ${tag}`, createdBy: creator })
      .returning();
    const device = await testApp.createIotDevice({ createdBy: creator, name: `Device ${tag}` });

    // The creator self-grants the earlier backfill wrote: grantee = created_by,
    // role 'admin'.
    for (const [type, id] of [
      ["macro", macro.id],
      ["protocol", protocol.id],
      ["workbook", workbook.id],
      ["device", device.id],
    ] as const) {
      await testApp.addResourceGrant({
        resourceType: type,
        resourceId: id,
        granteeType: "user",
        granteeId: creator,
        role: "admin",
        createdBy: creator,
      });
    }
    // A real share to somebody else must survive.
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: other,
      role: "viewer",
      createdBy: creator,
    });

    await runDataMigration(testApp.database);

    expect(await grantsFor("protocol", protocol.id)).toEqual([]);
    expect(await grantsFor("workbook", workbook.id)).toEqual([]);
    expect(await grantsFor("macro", macro.id)).toEqual([
      expect.objectContaining({ granteeId: other, role: "viewer" }),
    ]);
    // Devices are deliberately out of scope: nothing lists their grants, so the
    // phantom-collaborator problem does not arise and the row stays.
    expect(await grantsFor("device", device.id)).toEqual([
      expect.objectContaining({ granteeId: creator, role: "admin" }),
    ]);
  });

  it("re-applies cleanly onto its own output (an interrupted run can be resumed)", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const joiner = await testApp.createTestUser({ name: "Joiner" });
    const experiment = await seedExperiment(owner);
    await testApp.database.insert(experimentMembers).values([
      { experimentId: experiment.id, userId: owner, role: "admin" },
      { experimentId: experiment.id, userId: joiner, role: "member" },
    ]);

    await runDataMigration(testApp.database);
    const afterFirst = await grantsFor("experiment", experiment.id);
    await runDataMigration(testApp.database);
    const afterSecond = await grantsFor("experiment", experiment.id);

    // Same rows, same ids: the second pass inserts nothing and rewrites nothing, so
    // a run interrupted half-way can simply be run again.
    //
    // This is *not* a claim that re-running is safe at any later time: step 1
    // inserts where a grant is absent, so on a live database it would restore a
    // grant that had since been revoked, for anyone still in the dormant roster.
    // Drizzle's journal is what prevents that — each migration applies exactly once
    // per database — and the case below pins the failure mode so nobody mistakes
    // this test for a licence to re-run it by hand.
    expect(afterSecond.map((g) => g.id).sort()).toEqual(afterFirst.map((g) => g.id).sort());
    expect(Object.fromEntries(afterSecond.map((g) => [g.granteeId, g.role]))).toEqual({
      [owner]: "admin",
      [joiner]: "member",
    });
  });

  it("would restore a revoked grant if re-run after a revoke — which is why it runs once", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const joiner = await testApp.createTestUser({ name: "Joiner" });
    const experiment = await seedExperiment(owner);
    await testApp.database
      .insert(experimentMembers)
      .values({ experimentId: experiment.id, userId: joiner, role: "member" });

    await runDataMigration(testApp.database);
    const [granted] = await grantsFor("experiment", experiment.id);
    // Somebody revokes that access later, through the sharing surface.
    await testApp.removeResourceGrant(granted.id);
    expect(await grantsFor("experiment", experiment.id)).toEqual([]);

    await runDataMigration(testApp.database);

    // The roster row is still there, so a second application hands the access back.
    // Documented rather than defended against: drizzle applies a migration once per
    // database, and reaching this state means someone edited the journal by hand.
    expect(await grantsFor("experiment", experiment.id)).toEqual([
      expect.objectContaining({ granteeId: joiner, role: "member" }),
    ]);
  });

  it("gives one grant per member even when the same person is on several experiments", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const joiner = await testApp.createTestUser({ name: "Joiner" });
    const first = await seedExperiment(owner);
    const second = await seedExperiment(owner);
    await testApp.database.insert(experimentMembers).values([
      { experimentId: first.id, userId: joiner, role: "member" },
      { experimentId: second.id, userId: joiner, role: "admin" },
    ]);

    await runDataMigration(testApp.database);

    expect(await grantsFor("experiment", first.id)).toEqual([
      expect.objectContaining({ granteeId: joiner, role: "member" }),
    ]);
    expect(await grantsFor("experiment", second.id)).toEqual([
      expect.objectContaining({ granteeId: joiner, role: "admin" }),
    ]);
  });
});

/** The end state 0041 leaves behind, in the database rather than in the model. */
describe("grants-as-sole-access-source migration end state (0041)", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keys resource_grants on resource + grantee, with no provenance column", async () => {
    // One grant per grantee per resource, and no second axis: a grant is a grant,
    // whoever wrote it. Anything reintroducing a provenance column fails here.
    const columns = await testApp.database.execute<{ column_name: string }>(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'resource_grants'`,
    );
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      "created_at",
      "created_by",
      "grantee_id",
      "grantee_type",
      "id",
      "resource_id",
      "resource_type",
      "role",
      "updated_at",
    ]);

    const [uniqueIdx] = await testApp.database.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'resource_grants_unique'`,
    );
    expect(uniqueIdx.indexdef).toContain("(resource_type, resource_id, grantee_type, grantee_id)");

    const checks = await testApp.database.execute<{ conname: string }>(
      sql`SELECT c."conname" FROM pg_constraint c
          JOIN pg_class t ON t."oid" = c."conrelid"
          WHERE t."relname" = 'resource_grants' AND c."contype" = 'c'`,
    );
    expect(checks).toEqual([]);
  });

  it("leaves experiment_members physically intact, role column and enum included", async () => {
    // The consolidation is a code-level retirement, not a drop: the table keeps
    // its shape and its rows, frozen, and no migration or runtime path writes to
    // it. Anything that reintroduces DDL against it fails here.
    const columns = await testApp.database.execute<{ column_name: string }>(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'experiment_members'`,
    );
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      "experiment_id",
      "joined_at",
      "role",
      "user_id",
    ]);

    const enumValues = await testApp.database.execute<{ enumlabel: string }>(
      sql`SELECT e."enumlabel" FROM pg_enum e
          JOIN pg_type t ON t."oid" = e."enumtypid"
          WHERE t."typname" = 'experiment_members_role'
          ORDER BY e."enumsortorder"`,
    );
    expect(enumValues.map((e) => e.enumlabel)).toEqual(["admin", "member"]);
  });
});
