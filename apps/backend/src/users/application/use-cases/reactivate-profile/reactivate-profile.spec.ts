import { faker } from "@faker-js/faker";

import { eq, experimentAnnotations, experimentDataOutbox, profiles } from "@repo/database";

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

  it("owes the copy of every annotation the author made, which shows their name again, and no one else's", async () => {
    const userId = await testApp.createTestUser({ activated: false });
    const otherId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Shade trial", userId: otherId });
    const mine = await testApp.createAnnotation({ experimentId: experiment.id, createdBy: userId });
    await testApp.createAnnotation({ experimentId: experiment.id, createdBy: otherId });

    assertSuccess(await useCase.execute(userId));

    expect((await owed()).filter(({ recordType }) => recordType === "annotation")).toEqual([
      expect.objectContaining({
        recordId: mine.id,
        experimentId: experiment.id,
        destination: "lakehouse",
      }),
    ]);
  });

  it("owes more of an author's annotations than one outbox statement takes", async () => {
    const userId = await testApp.createTestUser({ activated: false });
    const { experiment } = await testApp.createExperiment({ name: "Shade trial", userId });
    await testApp.database.insert(experimentAnnotations).values(
      Array.from({ length: 1500 }, (_, row): typeof experimentAnnotations.$inferInsert => ({
        id: faker.string.uuid(),
        experimentId: experiment.id,
        tableName: "raw_data",
        rowId: String(row),
        type: "comment",
        createdBy: userId,
      })),
    );

    assertSuccess(await useCase.execute(userId));

    expect((await owed()).filter(({ recordType }) => recordType === "annotation")).toHaveLength(
      1500,
    );
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

  it("keeps the profile deactivated when the copies it owes cannot be written", async () => {
    const userId = await testApp.createTestUser({ activated: false });
    const { experiment } = await testApp.createExperiment({ name: "Shade trial", userId });
    await testApp.createAnnotation({ experimentId: experiment.id, createdBy: userId });
    // The rows land, and the failure after them takes them back with the activation.
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
