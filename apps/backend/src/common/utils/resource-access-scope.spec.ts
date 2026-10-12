import { eq, experiments } from "@repo/database";

import { TestHarness } from "../../test/test-harness";
import { resourceRoleExpression } from "./resource-access-scope";

describe("resourceRoleExpression", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function roleOf(experimentId: string, userId: string | undefined) {
    const [row] = await testApp.database
      .select({
        role: resourceRoleExpression({
          database: testApp.database,
          resourceType: "experiment",
          resourceIdColumn: experiments.id,
          organizationIdColumn: experiments.organizationId,
          userId,
        }),
      })
      .from(experiments)
      .where(eq(experiments.id, experimentId));
    return row.role;
  }

  it("is null for every row when there is no caller", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Owned by someone",
      userId: testUserId,
    });

    expect(await roleOf(experiment.id, undefined)).toBeNull();
  });

  it("names the role the caller holds", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Own work", userId: testUserId });

    expect(await roleOf(experiment.id, testUserId)).toBe("owner");
  });

  it("is null for a caller who reaches the row only because it is public", async () => {
    const otherUserId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Public",
      userId: otherUserId,
      visibility: "public",
    });

    expect(await roleOf(experiment.id, testUserId)).toBeNull();
  });
});
