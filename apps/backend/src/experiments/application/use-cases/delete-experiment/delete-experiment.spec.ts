import { eq, experiments, notifications } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  grantResourceAudience,
  heardByAllButTheActor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { DeleteExperimentUseCase } from "./delete-experiment";

describe("DeleteExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment for Deletion",
      userId: testUserId,
    });

    // Delete the experiment
    const result = await useCase.execute(experiment.id, testUserId);

    // Verify the operation was successful
    expect(result.isSuccess()).toBe(true);

    // Verify the experiment is gone by attempting to find it
    const experimentCheck = await testApp.database
      .select()
      .from(experiments)
      .where(eq(experiments.id, experiment.id))
      .limit(1);

    expect(experimentCheck.length).toBe(0);
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Try to delete a non-existent experiment
    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  /** One experiment in an organization, shared with an admin and a viewer. */
  async function sharedExperiment() {
    const audience = await seedResourceAudience(testApp);
    const { experiment } = await testApp.createExperiment({
      name: "Canopy Survey",
      userId: audience.owner,
      organizationId: audience.organizationId,
    });
    const resourceId = experiment.id;
    await grantResourceAudience(testApp, audience, "experiment", resourceId);
    return { audience, resourceId };
  }

  it("tells the grantees and the owner, not the deleter, and queues their emails", async () => {
    const { audience, resourceId } = await sharedExperiment();

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(await audienceNotifications(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, (recipientId) => ({
        type: "resource_deleted",
        recipientId,
        actorId: audience.actor,
        resourceType: "experiment",
        resourceId,
        params: { resourceName: "Canopy Survey" },
      })),
    );
    expect(await audienceDeliveries(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, () => ({ type: "resource_deleted", status: "pending" })),
    );
  });

  it("still deletes, telling nobody, when the members cannot be read", async () => {
    const { audience, resourceId } = await sharedExperiment();
    vi.spyOn(testApp.module.get(SharingRepository), "listMemberIds").mockResolvedValue(
      failure(AppError.internal("members unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database.select().from(experiments).where(eq(experiments.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });

  it("still deletes when the notification cannot be stored", async () => {
    const { audience, resourceId } = await sharedExperiment();
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database.select().from(experiments).where(eq(experiments.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });
});
