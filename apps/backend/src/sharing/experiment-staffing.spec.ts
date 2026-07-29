import { StatusCodes } from "http-status-codes";

import { and, createSecondaryDatabase, eq, inArray, resourceGrants } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { assertFailure, assertSuccess } from "../common/utils/fp-utils";
import { TestHarness } from "../test/test-harness";
import { SharingRepository } from "./sharing.repository";
import { CreateGrantUseCase } from "./use-cases/create-grant";
import { RevokeGrantUseCase } from "./use-cases/revoke-grant";
import { UpdateGrantUseCase } from "./use-cases/update-grant";

/**
 * The experiment last-admin invariant, which moved into the sharing use-cases when
 * grants became the only place an access tier lives: an experiment must always keep
 * at least one user grant with role `admin`/`owner`, so the last one can be neither
 * revoked nor demoted.
 *
 * Everything here is exercised through the use cases rather than the repository,
 * because the invariant's whole point is that **no** write path a `can(share)`
 * holder can reach gets around it — POST included, since re-sharing is an upsert
 * that can lower an existing role.
 */
describe("experiment last-admin invariant (sharing use-cases)", () => {
  const testApp = TestHarness.App;
  let createGrant: CreateGrantUseCase;
  let updateGrant: UpdateGrantUseCase;
  let revokeGrant: RevokeGrantUseCase;
  let owner: string;

  // A repository on its own connection. The app's pool is `max: 1`, so two writes
  // issued through `testApp` are serialized by the driver and never contend in
  // Postgres — a race driven only through it would pass even with no lock at all.
  // This second connection is what makes `SELECT … FOR UPDATE` actually block.
  let secondary: { database: DatabaseInstance; close: () => Promise<void> };
  let secondaryRepo: SharingRepository;

  beforeAll(async () => {
    await testApp.setup();
    secondary = createSecondaryDatabase();
    secondaryRepo = new SharingRepository(secondary.database);
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    createGrant = testApp.module.get(CreateGrantUseCase);
    updateGrant = testApp.module.get(UpdateGrantUseCase);
    revokeGrant = testApp.module.get(RevokeGrantUseCase);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await secondary.close();
    await testApp.teardown();
  });

  /** The owner's direct admin grant, seeded by create-experiment. */
  async function directGrant(experimentId: string, userId: string) {
    const [row] = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, experimentId),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
      );
    return row;
  }

  /** How many user grants with a staffing role remain. */
  async function staffingGrantCount(experimentId: string) {
    const rows = await testApp.database
      .select({ id: resourceGrants.id })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, experimentId),
          eq(resourceGrants.granteeType, "user"),
          inArray(resourceGrants.role, ["owner", "admin"]),
        ),
      );
    return rows.length;
  }

  async function seedExperiment() {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
    });
    return experiment;
  }

  it("refuses to revoke the last direct admin grant", async () => {
    const experiment = await seedExperiment();
    const grant = await directGrant(experiment.id, owner);

    const result = await revokeGrant.execute(owner, "experiment", experiment.id, grant.id);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(result.error.message).toContain("last admin");
    // Still there — the refusal happens before the delete, not after it.
    expect(await directGrant(experiment.id, owner)).toBeDefined();
  });

  it("refuses to demote the last direct admin grant", async () => {
    const experiment = await seedExperiment();
    const grant = await directGrant(experiment.id, owner);

    const result = await updateGrant.execute(owner, "experiment", experiment.id, grant.id, {
      role: "viewer",
    });

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(result.error.message).toContain("last admin");
    expect((await directGrant(experiment.id, owner)).role).toBe("admin");
  });

  it("allows revoking an admin grant once a second one exists", async () => {
    const experiment = await seedExperiment();
    const coAdmin = await testApp.createTestUser({ name: "Co-admin" });
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: coAdmin,
        role: "admin",
      }),
    );

    const grant = await directGrant(experiment.id, owner);
    assertSuccess(await revokeGrant.execute(owner, "experiment", experiment.id, grant.id));

    expect(await directGrant(experiment.id, owner)).toBeUndefined();
    expect((await directGrant(experiment.id, coAdmin)).role).toBe("admin");
  });

  it("allows demoting an admin grant once a second one exists", async () => {
    const experiment = await seedExperiment();
    const coAdmin = await testApp.createTestUser({ name: "Co-admin" });
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: coAdmin,
        role: "admin",
      }),
    );

    const grant = await directGrant(experiment.id, owner);
    assertSuccess(
      await updateGrant.execute(owner, "experiment", experiment.id, grant.id, { role: "viewer" }),
    );

    expect((await directGrant(experiment.id, owner)).role).toBe("viewer");
  });

  it("allows revoking a non-staffing grant while a single admin remains", async () => {
    const experiment = await seedExperiment();
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      }),
    );

    // Revoking a viewer never touches the admin count, so the invariant is silent.
    const grant = await directGrant(experiment.id, viewer);
    assertSuccess(await revokeGrant.execute(owner, "experiment", experiment.id, grant.id));
    expect(await directGrant(experiment.id, viewer)).toBeUndefined();
  });

  // F1: POST is an upsert, so it is a demotion path too — it was the one mutation
  // that never consulted the invariant.
  it("refuses to demote the last direct admin by re-sharing them at a lower role", async () => {
    const experiment = await seedExperiment();

    const result = await createGrant.execute(owner, "experiment", experiment.id, {
      granteeType: "user",
      granteeId: owner,
      role: "viewer",
    });

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(result.error.message).toContain("last admin");
    // The upsert never ran: the sole staffing grant is untouched.
    expect((await directGrant(experiment.id, owner)).role).toBe("admin");
  });

  it("allows re-sharing an admin at a lower role once a second admin exists", async () => {
    const experiment = await seedExperiment();
    const coAdmin = await testApp.createTestUser({ name: "Co-admin" });
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: coAdmin,
        role: "admin",
      }),
    );

    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: owner,
        role: "viewer",
      }),
    );

    expect((await directGrant(experiment.id, owner)).role).toBe("viewer");
    expect((await directGrant(experiment.id, coAdmin)).role).toBe("admin");
  });

  it("still allows re-sharing the last admin at the same or a higher role", async () => {
    const experiment = await seedExperiment();

    // Not a demotion, so the invariant has nothing to say — and the upsert must
    // remain idempotent for the re-share case the picker relies on.
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: owner,
        role: "admin",
      }),
    );

    expect((await directGrant(experiment.id, owner)).role).toBe("admin");
  });

  it("lets a brand-new grantee be added at any role", async () => {
    const experiment = await seedExperiment();
    const viewer = await testApp.createTestUser({ name: "Newcomer" });

    // No existing row for this grantee ⇒ nothing is being demoted.
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      }),
    );

    expect((await directGrant(experiment.id, viewer)).role).toBe("viewer");
  });

  // F3: the assert and the mutation must be one transaction with the staffing rows
  // locked, or two concurrent demotes each see a count of 2 and both commit.
  //
  // Both sides of these races run on *different connections* (see `secondary`), so
  // they genuinely overlap in Postgres and the row lock is what resolves them.
  // Verified to have teeth: deleting the `.for("update")` from
  // `lockStaffingGrants` makes the revoke+demote case below fail.
  describe("under real concurrent connections", () => {
    async function seedTwoAdmins() {
      const experiment = await seedExperiment();
      const coAdmin = await testApp.createTestUser({ name: `Co-admin ${crypto.randomUUID()}` });
      assertSuccess(
        await createGrant.execute(owner, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: coAdmin,
          role: "admin",
        }),
      );
      return {
        experiment,
        ownerGrant: await directGrant(experiment.id, owner),
        coAdminGrant: await directGrant(experiment.id, coAdmin),
      };
    }

    it("survives concurrent demotions of the only two admins", async () => {
      const { experiment, ownerGrant, coAdminGrant } = await seedTwoAdmins();

      const outcomes = await Promise.all([
        secondaryRepo.updateRole({
          resourceType: "experiment",
          resourceId: experiment.id,
          grantId: ownerGrant.id,
          role: "viewer",
        }),
        updateGrant.execute(owner, "experiment", experiment.id, coAdminGrant.id, {
          role: "viewer",
        }),
      ]);

      // Exactly one demotion may win; the other must be refused so a staffing grant
      // always survives.
      expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("survives a concurrent revoke and demote of the only two admins", async () => {
      const { experiment, ownerGrant, coAdminGrant } = await seedTwoAdmins();

      const outcomes = await Promise.all([
        secondaryRepo.revoke({
          resourceType: "experiment",
          resourceId: experiment.id,
          grantId: ownerGrant.id,
        }),
        updateGrant.execute(owner, "experiment", experiment.id, coAdminGrant.id, {
          role: "viewer",
        }),
      ]);

      expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("survives a concurrent revoke and demoting re-share of the only two admins", async () => {
      // The create-upsert is a demotion path too (F1), so it has to contend on the
      // same lock as the other two.
      const { experiment, ownerGrant, coAdminGrant } = await seedTwoAdmins();
      const coAdminId = (
        await testApp.database
          .select({ granteeId: resourceGrants.granteeId })
          .from(resourceGrants)
          .where(eq(resourceGrants.id, coAdminGrant.id))
      )[0].granteeId;

      const outcomes = await Promise.all([
        secondaryRepo.revoke({
          resourceType: "experiment",
          resourceId: experiment.id,
          grantId: ownerGrant.id,
        }),
        createGrant.execute(owner, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: coAdminId,
          role: "viewer",
        }),
      ]);

      expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });
  });

  it("does not count an organization grant as staffing", async () => {
    const experiment = await seedExperiment();
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, owner, "owner");
    assertSuccess(
      await createGrant.execute(owner, "experiment", experiment.id, {
        granteeType: "organization",
        granteeId: orgId,
        role: "admin",
      }),
    );

    // "Someone in that org can administer it" is not an answerable owner, so
    // the owner's grant is still the last one standing.
    const grant = await directGrant(experiment.id, owner);
    const result = await revokeGrant.execute(owner, "experiment", experiment.id, grant.id);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it("does not apply to macros, protocols or workbooks", async () => {
    // Only experiments collect other people's field data, so only experiments
    // carry the invariant; the other three types are authored artifacts backed by
    // their creator's org role.
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: collaborator,
        role: "admin",
      }),
    );
    const [grant] = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "macro"),
          eq(resourceGrants.resourceId, macro.id),
          eq(resourceGrants.granteeId, collaborator),
        ),
      );

    // The only admin grant on the macro, demoted and then revoked without complaint.
    assertSuccess(
      await updateGrant.execute(owner, "macro", macro.id, grant.id, { role: "viewer" }),
    );
    assertSuccess(await revokeGrant.execute(owner, "macro", macro.id, grant.id));
  });
});
