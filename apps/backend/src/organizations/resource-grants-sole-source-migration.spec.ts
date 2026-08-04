import {
  and,
  eq,
  ensurePersonalOrganization,
  experiments,
  experimentMembers,
  invitations,
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
 * `resource_grants` the only thing that confers *explicit* access to a shared
 * resource, and strips the creator grants that ownership makes redundant. They are
 * duplicated here so the migration's data ops are locked by tests — update both
 * together if the migration changes.
 *
 * `experiment_members` is only ever READ, so the specs seed it to reproduce the
 * pre-consolidation state and then assert what the grants look like afterwards.
 *
 * The migration's DDL — the column defaults and the role CHECKs — is not mirrored
 * here: it has applied by the time these run, and the end-state block below asserts
 * it directly against the database instead.
 */
const GRANT_EVERY_MEMBER_THEIR_ROLE_SQL = sql`
  INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role")
  SELECT 'experiment', em."experiment_id", 'user', em."user_id",
    CASE WHEN em."role" = 'admin' THEN 'admin' ELSE 'viewer' END
  FROM "experiment_members" em
  WHERE NOT EXISTS (
    SELECT 1 FROM "profiles" p
    WHERE p."user_id" = em."user_id"
      AND p."deleted_at" IS NOT NULL
  )
  ON CONFLICT DO NOTHING;
`;

const DELETE_CREATOR_GRANTS_SQL = sql`
  DELETE FROM "resource_grants" g
  USING (
    SELECT 'experiment'::"resource_type" AS "resource_type", e."id", e."created_by", e."organization_id" FROM "experiments" e
    UNION ALL
    SELECT 'macro'::"resource_type", m."id", m."created_by", m."organization_id" FROM "macros" m
    UNION ALL
    SELECT 'protocol'::"resource_type", p."id", p."created_by", p."organization_id" FROM "protocols" p
    UNION ALL
    SELECT 'workbook'::"resource_type", w."id", w."created_by", w."organization_id" FROM "workbooks" w
    UNION ALL
    SELECT 'device'::"resource_type", d."id", d."created_by", d."organization_id" FROM "iot_devices" d
  ) r
  WHERE g."resource_type" = r."resource_type"
    AND g."resource_id" = r."id"
    AND g."grantee_type" = 'user'
    AND g."grantee_id" = r."created_by"
    AND EXISTS (
      SELECT 1 FROM "organization_members" om
      WHERE om."organization_id" = r."organization_id"
        AND om."user_id" = r."created_by"
        AND om."role" IN ('owner', 'admin')
    );
`;

/** Rewrites the rows that still spell the read-and-contribute tier `member`. */
const RETIRE_MEMBER_SPELLING_SQL = sql`
  UPDATE "resource_grants" SET "role" = 'viewer' WHERE "role" = 'member';
`;

const RETIRE_MEMBER_SPELLING_INVITATIONS_SQL = sql`
  UPDATE "invitations" SET "role" = 'viewer' WHERE "role" = 'member';
`;

async function runDataMigration(db: DatabaseInstance): Promise<void> {
  await db.execute(GRANT_EVERY_MEMBER_THEIR_ROLE_SQL);
  await db.execute(DELETE_CREATOR_GRANTS_SQL);
  await db.execute(RETIRE_MEMBER_SPELLING_SQL);
  await db.execute(RETIRE_MEMBER_SPELLING_INVITATIONS_SQL);
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
    const organizationId = await ensurePersonalOrganization(testApp.database, { id: owner });
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({ name: `Exp ${crypto.randomUUID()}`, createdBy: owner, organizationId })
      .returning();
    return experiment;
  }

  it.each([
    ["member", "viewer"],
    ["admin", "admin"],
  ] as const)(
    "grants a roster %s the matching grant role when they hold no grant at all",
    async (rosterRole, grantRole) => {
      const owner = await testApp.createTestUser({ name: "Owner" });
      const joiner = await testApp.createTestUser({ name: "Joiner" });
      const experiment = await seedExperiment(owner);
      // The shape invitation acceptance left behind: a roster row and no grant.
      // Without this migration that person loses access entirely.
      await testApp.database
        .insert(experimentMembers)
        .values({ experimentId: experiment.id, userId: joiner, role: rosterRole });

      await runDataMigration(testApp.database);

      expect(await grantsFor("experiment", experiment.id)).toEqual([
        expect.objectContaining({ granteeId: joiner, role: grantRole, createdBy: null }),
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

  /**
   * A macro/protocol/workbook/device authored by `creator`, each already carrying
   * the creator self-grant that 0039 wrote — the rows statement 2 exists to remove.
   * `organizationId` defaults to the creator's personal org (which they own); pass
   * `null` to reproduce a row that predates the org backfill.
   *
   * The `null` case reaches only the first three: a device's organization is set
   * at registration and the harness has no way to seed one without it, so the
   * pre-backfill case is asserted on the other types.
   */
  async function seedAuthoredResources(creator: string, organizationId?: string | null) {
    const personalOrg = await ensurePersonalOrganization(testApp.database, { id: creator });
    const owningOrg = organizationId === undefined ? personalOrg : organizationId;
    const tag = crypto.randomUUID();

    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `Macro ${tag}`,
        filename: `${tag}.py`,
        language: "python",
        code: "cHk=",
        createdBy: creator,
        organizationId: owningOrg,
      })
      .returning();
    const [protocol] = await testApp.database
      .insert(protocols)
      .values({
        name: `Protocol ${tag}`,
        code: { steps: [] },
        family: "multispeq",
        createdBy: creator,
        organizationId: owningOrg,
      })
      .returning();
    const [workbook] = await testApp.database
      .insert(workbooks)
      .values({ name: `Workbook ${tag}`, createdBy: creator, organizationId: owningOrg })
      .returning();
    const device = await testApp.createIotDevice({
      createdBy: creator,
      name: `Device ${tag}`,
      ...(owningOrg ? { organizationId: owningOrg } : {}),
    });

    for (const [resourceType, id] of [
      ["macro", macro.id],
      ["protocol", protocol.id],
      ["workbook", workbook.id],
      ["device", device.id],
    ] as const) {
      await testApp.addResourceGrant({
        resourceType,
        resourceId: id,
        granteeType: "user",
        granteeId: creator,
        role: "admin",
        createdBy: creator,
      });
    }

    return { macro, protocol, workbook, device };
  }

  it("strips the creator's own grant from every macro, protocol and workbook", async () => {
    const creator = await testApp.createTestUser({ name: "Creator" });
    const { macro, protocol, workbook } = await seedAuthoredResources(creator);

    await runDataMigration(testApp.database);

    // The creator owns the personal org each of these sits in, so the grant conferred
    // nothing — and left them rendering as a collaborator on their own resource
    // beside the synthesized Owner row.
    for (const [type, id] of [
      ["macro", macro.id],
      ["protocol", protocol.id],
      ["workbook", workbook.id],
    ] as const) {
      expect(await grantsFor(type, id)).toEqual([]);
    }
  });

  it("strips the experiment creator grant statement 1 just revived from the roster", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const experiment = await seedExperiment(owner);
    // The creator was an admin on the dormant roster, so statement 1 re-inserts
    // their grant — statement 2 has to take it back out, or experiments would keep
    // a creator grant the other three types no longer have.
    await testApp.database
      .insert(experimentMembers)
      .values({ experimentId: experiment.id, userId: owner, role: "admin" });

    await runDataMigration(testApp.database);

    expect(await grantsFor("experiment", experiment.id)).toEqual([]);
  });

  it("strips the creator's own grant from a device too", async () => {
    const creator = await testApp.createTestUser({ name: "Creator" });
    const { device } = await seedAuthoredResources(creator);

    await runDataMigration(testApp.database);

    // Devices carry the same collaborators surface as everything else, and 0039
    // backfilled a creator admin grant on each of them — left in place it would
    // render the creator as a collaborator beside their own Owner row.
    expect(await grantsFor("device", device.id)).toEqual([]);
  });

  it("keeps everyone else's grants", async () => {
    const creator = await testApp.createTestUser({ name: "Creator" });
    const other = await testApp.createTestUser({ name: "Other" });
    const { macro } = await seedAuthoredResources(creator);
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: other,
      role: "viewer",
      createdBy: creator,
    });

    await runDataMigration(testApp.database);

    // Only the creator's row goes; a real collaborator is untouched.
    expect(await grantsFor("macro", macro.id)).toEqual([
      expect.objectContaining({ granteeId: other, role: "viewer" }),
    ]);
  });

  it("keeps a creator's grant when the resource has no owning organization", async () => {
    const creator = await testApp.createTestUser({ name: "Orphan Creator" });
    const { macro, protocol, workbook } = await seedAuthoredResources(creator, null);

    await runDataMigration(testApp.database);

    // `organization_id` is nullable and rows predating the org backfill still carry
    // NULL. There is no owning org to inherit access from and no Owner row to
    // render, so the creator's grant is their *only* access — deleting it would
    // lock them out of their own resource.
    for (const [type, id] of [
      ["macro", macro.id],
      ["protocol", protocol.id],
      ["workbook", workbook.id],
    ] as const) {
      expect(await grantsFor(type, id)).toEqual([
        expect.objectContaining({ granteeId: creator, role: "admin" }),
      ]);
    }
  });

  it("keeps a creator's grant when they are only a member of the owning organization", async () => {
    const creator = await testApp.createTestUser({ name: "Member Creator" });
    const sharedOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(sharedOrg, creator, "member");
    const { macro } = await seedAuthoredResources(creator, sharedOrg);

    await runDataMigration(testApp.database);

    // An org `member` gets read only, so the creator's admin grant is doing real
    // work here — it is not redundant with the org role and must survive.
    expect(await grantsFor("macro", macro.id)).toEqual([
      expect.objectContaining({ granteeId: creator, role: "admin" }),
    ]);
  });

  it("strips the creator's grant when they are an admin of the owning organization", async () => {
    const creator = await testApp.createTestUser({ name: "Admin Creator" });
    const sharedOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(sharedOrg, creator, "admin");
    const { macro } = await seedAuthoredResources(creator, sharedOrg);

    await runDataMigration(testApp.database);

    // Org `admin` carries every action, exactly like `owner`, so the grant is as
    // redundant as it is in a personal workspace.
    expect(await grantsFor("macro", macro.id)).toEqual([]);
  });

  it("re-applies cleanly onto its own output (an interrupted run can be resumed)", async () => {
    const owner = await testApp.createTestUser({ name: "Owner" });
    const joiner = await testApp.createTestUser({ name: "Joiner" });
    const experiment = await seedExperiment(owner);
    await testApp.database.insert(experimentMembers).values([
      { experimentId: experiment.id, userId: owner, role: "admin" },
      { experimentId: experiment.id, userId: joiner, role: "member" },
    ]);
    // Both statements have to be re-runnable, so the creator-grant delete needs a
    // resource of each authored type in the fixture too — the roster rows above only
    // exercise the first one.
    const { macro, protocol, workbook } = await seedAuthoredResources(owner);

    const authoredGrants = async () =>
      Object.fromEntries(
        await Promise.all(
          (
            [
              ["macro", macro.id],
              ["protocol", protocol.id],
              ["workbook", workbook.id],
            ] as const
          ).map(async ([type, id]) => [type, await grantsFor(type, id)] as const),
        ),
      );

    await runDataMigration(testApp.database);
    const afterFirst = await grantsFor("experiment", experiment.id);
    const authoredAfterFirst = await authoredGrants();
    await runDataMigration(testApp.database);
    const afterSecond = await grantsFor("experiment", experiment.id);
    const authoredAfterSecond = await authoredGrants();

    // The same end state either way, so a run interrupted half-way can simply be
    // run again. The owner's roster row is re-inserted by statement 1 on the second
    // pass and removed again by statement 2 — churn that nets to nothing, which is
    // what "idempotent" has to mean for a pair whose halves pull in opposite
    // directions.
    //
    // This is *not* a claim that re-running is safe at any later time: step 1
    // inserts where a grant is absent, so on a live database it would restore a
    // grant that had since been revoked, for anyone still in the dormant roster.
    // Drizzle's journal is what prevents that — each migration applies exactly once
    // per database — and the case below pins the failure mode so nobody mistakes
    // this test for a licence to re-run it by hand.
    expect(Object.fromEntries(afterSecond.map((g) => [g.granteeId, g.role]))).toEqual(
      Object.fromEntries(afterFirst.map((g) => [g.granteeId, g.role])),
    );
    // The creator is gone; only the joiner's roster-derived grant remains.
    expect(Object.fromEntries(afterSecond.map((g) => [g.granteeId, g.role]))).toEqual({
      [joiner]: "viewer",
    });

    // The creator-grant delete is naturally idempotent: the second pass finds
    // nothing left to delete.
    expect(authoredAfterSecond).toEqual(authoredAfterFirst);
    for (const grants of Object.values(authoredAfterFirst)) {
      expect(grants).toEqual([]);
    }
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
      expect.objectContaining({ granteeId: joiner, role: "viewer" }),
    ]);
  });

  it.each(["resource_grants", "invitations"] as const)(
    "rewrites a pre-existing 'member' row in %s to 'viewer'",
    async (table) => {
      const owner = await testApp.createTestUser({ name: "Owner" });
      const subject = await testApp.createTestUser({ name: "Subject" });
      const experiment = await seedExperiment(owner);

      // What 0039's mirror and the pre-release write paths left behind. Inserted
      // directly because no typed helper can express the retired spelling any more.
      if (table === "resource_grants") {
        await testApp.database.insert(resourceGrants).values({
          resourceType: "experiment",
          resourceId: experiment.id,
          granteeType: "user",
          granteeId: subject,
          role: "member",
        });
      } else {
        await testApp.database.insert(invitations).values({
          resourceType: "experiment",
          resourceId: experiment.id,
          email: `legacy-${crypto.randomUUID()}@example.com`,
          role: "member",
          invitedBy: owner,
        });
      }

      await runDataMigration(testApp.database);

      const roles = await testApp.database.execute<{ role: string }>(
        sql`SELECT "role" FROM ${sql.identifier(table)}`,
      );
      // Same tier either way, so nobody's access moves — but only one name is left,
      // which is what makes a `WHERE role = 'viewer'` find every row of that tier.
      expect(roles.map((r) => r.role)).toEqual(["viewer"]);
    },
  );

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
      expect.objectContaining({ granteeId: joiner, role: "viewer" }),
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

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
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

  it.each([
    ["resource_grants", "viewer"],
    ["invitations", "viewer"],
  ])("defaults %s.role to %s", async (table, expected) => {
    const [column] = await testApp.database.execute<{ column_default: string | null }>(
      sql`SELECT column_default FROM information_schema.columns
          WHERE table_name = ${table} AND column_name = 'role'`,
    );
    expect(column.column_default).toBe(`'${expected}'::text`);
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
