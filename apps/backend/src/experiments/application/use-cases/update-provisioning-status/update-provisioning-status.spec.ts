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

      const testPipelineId = "test-pipeline-id-123";
      const testSchemaName = "exp_00001_abc123def456";

      // Execute the use case with SUCCESS status and metadata
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "SUCCESS",
        pipelineId: testPipelineId,
        schemaName: testSchemaName,
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
      expect(updatedExperiment?.pipelineId).toBe(testPipelineId);
      expect(updatedExperiment?.schemaName).toBe(testSchemaName);
    });

    it("should update experiment status to 'active' when Databricks status is 'COMPLETED'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for COMPLETED",
        description: "Testing status update from COMPLETED",
        status: "provisioning",
        userId: testUserId,
      });

      const testPipelineId = "completed-pipeline-456";
      const testSchemaName = "exp_00002_def789ghi012";

      // Execute the use case with COMPLETED status and metadata
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "COMPLETED",
        pipelineId: testPipelineId,
        schemaName: testSchemaName,
      });

      // Assert the result is successful and the status is now active
      assertSuccess(result);
      expect(result.value).toBe("active");

      // Verify that the experiment was actually updated in the database
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("active");
      expect(updatedExperimentResult.value?.pipelineId).toBe(testPipelineId);
      expect(updatedExperimentResult.value?.schemaName).toBe(testSchemaName);
    });

    it("should update experiment status to 'provisioning_failed' when Databricks status is 'FAILURE'", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for FAILURE",
        description: "Testing status update from FAILURE",
        status: "provisioning",
        userId: testUserId,
      });

      // Execute the use case with FAILURE status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "FAILURE",
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
        status: "provisioning",
        userId: testUserId,
      });

      // Execute the use case with FAILED status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "FAILED",
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
        status: "provisioning",
        userId: testUserId,
      });

      // Execute the use case with CANCELED status
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "CANCELED",
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
        status: "RUNNING",
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
        status: "SUCCESS",
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
        status: "SUCCESS",
      });

      // Assert the result is successful and the status is still active
      assertSuccess(result);
      expect(result.value).toBe("active");

      // Verify that the experiment status wasn't changed
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("active");
    });

    it("should update pipelineId and schemaName even if status is already correct", async () => {
      // Create an experiment that's already active but missing metadata
      const { experiment } = await testApp.createExperiment({
        name: "Active Experiment Without Metadata",
        description: "Testing metadata update on already active experiment",
        status: "active" as ExperimentStatus,
        userId: testUserId,
      });

      const testPipelineId = "late-pipeline-789";
      const testSchemaName = "exp_00003_ghi345jkl678";

      // Execute the use case with metadata for an already active experiment
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "SUCCESS",
        pipelineId: testPipelineId,
        schemaName: testSchemaName,
      });

      // Assert the result is successful
      assertSuccess(result);
      expect(result.value).toBe("active");

      // Verify that metadata was updated even though status didn't change
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("active");
      expect(updatedExperimentResult.value?.pipelineId).toBe(testPipelineId);
      expect(updatedExperimentResult.value?.schemaName).toBe(testSchemaName);
    });

    it("should not update metadata for failed provisioning", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Failure Without Metadata",
        description: "Testing that failed provisioning doesn't set metadata",
        status: "provisioning",
        userId: testUserId,
      });

      // Store original metadata (schemaName is auto-generated by test harness)
      const originalSchemaName = experiment.schemaName;
      const originalPipelineId = experiment.pipelineId;

      // Execute the use case with FAILED status (no metadata should be passed)
      const result = await useCase.execute({
        experimentId: experiment.id,
        status: "FAILED",
      });

      // Assert the result is successful and the status is now provisioning_failed
      assertSuccess(result);
      expect(result.value).toBe("provisioning_failed");

      // Verify that the metadata was not changed
      const updatedExperimentResult = await repository.findOne(experiment.id);

      assertSuccess(updatedExperimentResult);
      expect(updatedExperimentResult.value?.status).toBe("provisioning_failed");
      // Metadata should remain unchanged from before the failure
      expect(updatedExperimentResult.value?.pipelineId).toBe(originalPipelineId);
      expect(updatedExperimentResult.value?.schemaName).toBe(originalSchemaName);
    });
  });
});
