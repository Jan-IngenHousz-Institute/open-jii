import { eq, experiments } from "@repo/database";

import { assertFailure, failure, AppError, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { DeleteExperimentUseCase } from "./delete-experiment";

describe("DeleteExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentUseCase;
  let metadataRepository: ExperimentMetadataRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentUseCase);
    metadataRepository = testApp.module.get(ExperimentMetadataRepository);
    vi.restoreAllMocks();
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

  it("should return FORBIDDEN error if user is not a member", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Access Control Test",
      userId: testUserId,
    });

    // Create another user who is not a member
    const otherUserId = await testApp.createTestUser({});

    // Try to delete as non-member
    const result = await useCase.execute(experiment.id, otherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("Only experiment members can delete experiments");
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Try to delete a non-existent experiment
    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should attempt to delete metadata from Databricks before deleting the experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Cleanup Test",
      userId: testUserId,
    });

    const deleteByExperimentIdSpy = vi
      .spyOn(metadataRepository, "deleteByExperimentId")
      .mockResolvedValue(success(true));

    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    expect(deleteByExperimentIdSpy).toHaveBeenCalledWith(experiment.id);
  });

  it("should still delete the experiment even if metadata cleanup fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Cleanup Failure Test",
      userId: testUserId,
    });

    // Simulate Databricks metadata deletion failure
    vi.spyOn(metadataRepository, "deleteByExperimentId").mockResolvedValue(
      failure(AppError.internal("Databricks connection failed")),
    );

    // The experiment should still be deleted successfully
    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);

    // Verify the experiment is actually gone from Postgres
    const experimentCheck = await testApp.database
      .select()
      .from(experiments)
      .where(eq(experiments.id, experiment.id))
      .limit(1);

    expect(experimentCheck.length).toBe(0);
  });
});
