import {
  and,
  backfillExperimentOrganizationsAndGrants,
  backfillOwnedEntitiesOwnership,
  eq,
  experiments,
  macros,
  resourceGrants,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";

describe("resource ownership backfills", () => {
  const testApp = TestHarness.App;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Backfill User" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("assigns experiment org + mirrors experiment_members into resource_grants (idempotent)", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Backfill Exp", userId });
    const before = await testApp.database
      .select({ organizationId: experiments.organizationId })
      .from(experiments)
      .where(eq(experiments.id, experiment.id));
    expect(before[0].organizationId).toBeNull();

    const res = await backfillExperimentOrganizationsAndGrants(testApp.database);
    expect(res.experimentsUpdated).toBeGreaterThanOrEqual(1);

    const after = await testApp.database
      .select({ organizationId: experiments.organizationId })
      .from(experiments)
      .where(eq(experiments.id, experiment.id));
    expect(after[0].organizationId).toBeTruthy();

    const grants = () =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeId, userId),
          ),
        );
    const first = await grants();
    expect(first).toHaveLength(1);
    expect(first[0].role).toBe("admin");

    // Idempotent: re-running creates no duplicates.
    await backfillExperimentOrganizationsAndGrants(testApp.database);
    expect(await grants()).toHaveLength(1);
  });

  it("assigns owned-entity org + admin grant for macros (idempotent)", async () => {
    const macro = await testApp.createMacro({ name: "Backfill Macro", createdBy: userId });
    const before = await testApp.database
      .select({ organizationId: macros.organizationId })
      .from(macros)
      .where(eq(macros.id, macro.id));
    expect(before[0].organizationId).toBeNull();

    const counts = await backfillOwnedEntitiesOwnership(testApp.database);
    expect(counts.macros).toBeGreaterThanOrEqual(1);

    const after = await testApp.database
      .select({ organizationId: macros.organizationId })
      .from(macros)
      .where(eq(macros.id, macro.id));
    expect(after[0].organizationId).toBeTruthy();

    const grants = () =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "macro"),
            eq(resourceGrants.resourceId, macro.id),
            eq(resourceGrants.granteeId, userId),
          ),
        );
    const first = await grants();
    expect(first).toHaveLength(1);
    expect(first[0].role).toBe("admin");

    await backfillOwnedEntitiesOwnership(testApp.database);
    expect(await grants()).toHaveLength(1);
  });
});
