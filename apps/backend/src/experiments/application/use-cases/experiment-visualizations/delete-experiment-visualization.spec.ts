import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { DeleteExperimentVisualizationUseCase } from "./delete-experiment-visualization";

describe("DeleteExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentVisualizationUseCase;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentVisualizationUseCase);
    experimentVisualizationRepository = testApp.module.get(ExperimentVisualizationRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    const visualizationId = faker.string.uuid();
    it("should successfully delete a visualization", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const mockVisualization: ExperimentVisualizationDto = {
        id: visualizationId,
        experimentId: experiment.id,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: testUserId, // Now this will have the correct value
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      vi.spyOn(experimentVisualizationRepository, "delete").mockResolvedValue(success(undefined));

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should fail when visualization does not exist", async () => {
      // Arrange
      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        failure({
          message: "Visualization not found",
          code: "NOT_FOUND",
          statusCode: 404,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Visualization not found");
    });

    it("should allow any experiment member to delete a visualization even if not the creator", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const differentUserVisualization: ExperimentVisualizationDto = {
        id: visualizationId,
        experimentId: experiment.id,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: faker.string.uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(differentUserVisualization),
      );

      vi.spyOn(experimentVisualizationRepository, "delete").mockResolvedValue(success(undefined));

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should fail when repository delete operation fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const mockVisualization: ExperimentVisualizationDto = {
        id: visualizationId,
        experimentId: experiment.id,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: testUserId, // User is the owner
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      vi.spyOn(experimentVisualizationRepository, "delete").mockResolvedValue(
        failure({
          message: "Database error",
          code: "DATABASE_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to delete visualization");
    });

    it("should fail when visualization belongs to non-existent experiment", async () => {
      // Arrange
      const nonExistentExperimentId = faker.string.uuid();
      const mockVisualization: ExperimentVisualizationDto = {
        id: visualizationId,
        experimentId: nonExistentExperimentId,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should allow any experiment member to delete visualization even if not creator", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const otherUserId = faker.string.uuid();
      const mockVisualization: ExperimentVisualizationDto = {
        id: visualizationId,
        experimentId: experiment.id,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: otherUserId, // Different user created it
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      vi.spyOn(experimentVisualizationRepository, "delete").mockResolvedValue(success(undefined));

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should fail when visualization findById returns success with null", async () => {
      // Arrange - Mock findById to return success with null (instead of failure)
      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(success(null));

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Visualization with ID ${visualizationId} not found`);
    });

    it("should forbid any user from deleting visualizations of archived experiments", async () => {
      // Create an archived experiment
      const { experiment } = await testApp.createExperiment({
        name: "Archived Experiment",
        status: "archived",
        userId: testUserId,
      });

      const mockVisualization: ExperimentVisualizationDto = {
        id: visualizationId,
        experimentId: experiment.id,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Cannot modify an archived experiment");
    });
  });
});
