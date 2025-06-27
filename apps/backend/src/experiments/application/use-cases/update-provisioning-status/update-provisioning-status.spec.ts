import type { DatabricksTaskRunStatus } from "@repo/api";
import type { ExperimentStatus } from "@repo/api";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { UpdateProvisioningStatusUseCase } from "./update-provisioning-status";

describe("UpdateProvisioningStatusUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateProvisioningStatusUseCase;
  let repository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateProvisioningStatusUseCase);
    repository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should update experiment status to 'active' when Databricks status is 'SUCCESS'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for SUCCESS",
        description: "Testing status update from SUCCESS",
        status: "provisioning" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with SUCCESS status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "SUCCESS" as DatabricksTaskRunStatus,
      });

      // Assert the result is successful and the status is now active
      assertSuccess(result);
      expect(result.value).toBe("active");

      // Verify that the experiment was actually updated in the database
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      const updatedExperiment = updatedExperimentResult.value;
      expect(updatedExperiment).not.toBeNull();
      expect(updatedExperiment?.status).toBe("active");
    });

    it("should update experiment status to 'active' when Databricks status is 'COMPLETED'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for COMPLETED",
        description: "Testing status update from COMPLETED",
        status: "provisioning" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with COMPLETED status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "COMPLETED" as DatabricksTaskRunStatus,
      });

      // Assert the result is successful and the status is now active
      assertSuccess(result);
      expect(result.value).toBe("active");

      // Verify that the experiment was actually updated in the database
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("active");
    });

    it("should update experiment status to 'provisioning_failed' when Databricks status is 'FAILURE'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for FAILURE",
        description: "Testing status update from FAILURE",
        status: "provisioning" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with FAILURE status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "FAILURE" as DatabricksTaskRunStatus,
      });

      // Assert the result is successful and the status is now provisioning_failed
      assertSuccess(result);
      expect(result.value).toBe("provisioning_failed");

      // Verify that the experiment was actually updated in the database
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("provisioning_failed");
    });

    it("should update experiment status to 'provisioning_failed' when Databricks status is 'FAILED'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for FAILED",
        description: "Testing status update from FAILED",
        status: "provisioning" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with FAILED status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "FAILED" as DatabricksTaskRunStatus,
      });

      // Assert the result is successful and the status is now provisioning_failed
      assertSuccess(result);
      expect(result.value).toBe("provisioning_failed");

      // Verify that the experiment was actually updated in the database
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("provisioning_failed");
    });

    it("should update experiment status to 'provisioning_failed' when Databricks status is 'CANCELED'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for CANCELED",
        description: "Testing status update from CANCELED",
        status: "provisioning" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with CANCELED status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "CANCELED" as DatabricksTaskRunStatus,
      });

      // Assert the result is successful and the status is now provisioning_failed
      assertSuccess(result);
      expect(result.value).toBe("provisioning_failed");

      // Verify that the experiment was actually updated in the database
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("provisioning_failed");
    });

    it("should return error for non-terminal status", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for RUNNING",
        description: "Testing status update from RUNNING",
        status: "provisioning" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with a non-terminal status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "RUNNING" as DatabricksTaskRunStatus,
      });

      // Assert the result is a failure with the correct error message
      assertFailure(result);
      expect(result.error.message).toContain("Non-terminal status");

      // Verify that the experiment status was not changed
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("provisioning");
    });

    it("should return not found error when experiment does not exist", async () => {
      // Use a non-existent experiment ID
      const nonExistentId = "11111111-1111-1111-1111-111111111111";

      // Execute the use case with a non-existent experiment ID
      const result = await useCase.execute({
        experimentId: nonExistentId,
        status: "SUCCESS" as DatabricksTaskRunStatus,
      });

      // Assert the result is a failure with the correct error message
      assertFailure(result);
      expect(result.error.message).toContain("not found");
    });

    it("should return the current status if experiment is already in target state", async () => {
      // Create an experiment that's already in the active state
      const { experiment } = await testApp.createExperiment({
        name: "Already Active Experiment",
        description: "Testing idempotency",
        status: "active" as ExperimentStatus,
        userId: testUserId,
      });

      // Execute the use case with SUCCESS status (which should map to active)
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "SUCCESS" as DatabricksTaskRunStatus,
      });

      // Assert the result is successful and the status is still active
      assertSuccess(result);
      expect(result.value).toBe("active");

      // Verify that the experiment status wasn't changed
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("active");
    });
  });
});
