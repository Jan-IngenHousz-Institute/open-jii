import { eq, experiments, like, profiles } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeletionBlockersUseCase } from "../../../../users/application/use-cases/get-deletion-blockers/get-deletion-blockers";
import { SeedDeletionBlockersUseCase } from "./seed-deletion-blockers";

describe("SeedDeletionBlockersUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let seedUseCase: SeedDeletionBlockersUseCase;
  let blockersUseCase: GetDeletionBlockersUseCase;

  const prefix = (userId: string) => `[seed:${userId}] `;

  const makeMockUser = async (email: string) => {
    const id = await testApp.createTestUser({ email });
    await testApp.database
      .update(profiles)
      .set({ avatarUrl: "https://example.com/avatar.png" })
      .where(eq(profiles.userId, id));
    return id;
  };

  const seededExperimentNames = async (userId: string) => {
    const rows = await testApp.database
      .select({ name: experiments.name })
      .from(experiments)
      .where(like(experiments.name, `${prefix(userId)}%`));
    return rows.map((r) => r.name.replace(prefix(userId), "")).sort();
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    seedUseCase = testApp.module.get(SeedDeletionBlockersUseCase);
    blockersUseCase = testApp.module.get(GetDeletionBlockersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("seeds every case and they surface correctly as deletion blockers", async () => {
    await makeMockUser("mock-a@example.com");
    await makeMockUser("mock-b@example.com");

    const seedResult = await seedUseCase.seed(testUserId);
    assertSuccess(seedResult);
    expect(seedResult.value.created).toBe(5);

    expect(await seededExperimentNames(testUserId)).toEqual([
      "active-co-admin",
      "active-solo",
      "active-with-members",
      "archived-solo",
      "archived-with-members",
    ]);

    // Only the sole-admin experiments block deletion — the co-admin one must NOT appear.
    const blockers = await blockersUseCase.execute(testUserId);
    assertSuccess(blockers);
    const blockerSuffixes = blockers.value
      .map((b) => b.name.replace(prefix(testUserId), ""))
      .sort();
    expect(blockerSuffixes).toEqual([
      "active-solo",
      "active-with-members",
      "archived-solo",
      "archived-with-members",
    ]);

    // The with-members case carries its mock members as transfer candidates.
    const withMembers = blockers.value.find((b) => b.name.endsWith("active-with-members"));
    expect(withMembers?.candidates).toHaveLength(2);
  });

  it("is idempotent — re-seeding creates nothing new", async () => {
    await seedUseCase.seed(testUserId);
    const second = await seedUseCase.seed(testUserId);

    assertSuccess(second);
    expect(second.value.created).toBe(0);
    expect(await seededExperimentNames(testUserId)).toHaveLength(5);
  });

  it("clears seeded experiments and unblocks deletion", async () => {
    await seedUseCase.seed(testUserId);

    const clearResult = await seedUseCase.clear(testUserId);
    assertSuccess(clearResult);
    expect(clearResult.value.deleted).toBe(5);

    expect(await seededExperimentNames(testUserId)).toEqual([]);
    const blockers = await blockersUseCase.execute(testUserId);
    assertSuccess(blockers);
    expect(blockers.value).toEqual([]);
  });
});
