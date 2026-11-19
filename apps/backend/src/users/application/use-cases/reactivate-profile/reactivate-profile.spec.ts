import { eq, experimentDataOutbox, profiles } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { TestHarness } from "../../../../test/test-harness";
import { ReactivateProfileUseCase } from "./reactivate-profile";

describe("ReactivateProfileUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ReactivateProfileUseCase;

  const owed = () => testApp.database.select().from(experimentDataOutbox);

  async function isActivated(userId: string): Promise<boolean> {
    const [profile] = await testApp.database
      .select({ activated: profiles.activated })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return profile.activated;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(ReactivateProfileUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("activates a deactivated profile and owes its unmasked name to the lakehouse copy, nudging the worker", async () => {
    const userId = await testApp.createTestUser({ activated: false });
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toBe(true);
    expect(await isActivated(userId)).toBe(true);
    expect(await owed()).toEqual([
      expect.objectContaining({
        recordType: "contributor",
        recordId: userId,
        experimentId: null,
        destination: "lakehouse",
      }),
    ]);
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it("owes nothing for a profile that was active already", async () => {
    const userId = await testApp.createTestUser({});
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toBe(false);
    expect(await owed()).toEqual([]);
    expect(nudge).not.toHaveBeenCalled();
  });

  it("keeps the profile deactivated when the copy it owes cannot be written", async () => {
    const userId = await testApp.createTestUser({ activated: false });
    // The row lands, and the failure after it takes it back with the activation.
    const real = new ExperimentDataOutboxRepository(testApp.database);
    const outbox = testApp.module.get(ExperimentDataOutboxRepository);
    vi.spyOn(outbox, "owe").mockImplementation(async (tx, records) => {
      await real.owe(tx, records);
      throw new Error("outbox unavailable");
    });
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    assertFailure(await useCase.execute(userId));

    expect(await isActivated(userId)).toBe(false);
    expect(await owed()).toEqual([]);
    expect(nudge).not.toHaveBeenCalled();
  });
});
