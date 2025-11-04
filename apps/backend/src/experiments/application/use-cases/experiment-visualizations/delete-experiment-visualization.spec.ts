import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { DeleteExperimentVisualizationUseCase } from "./delete-experiment-visualization";

describe("DeleteExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentVisualizationUseCase;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;
  let experimentRepository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentVisualizationUseCase);
    experimentVisualizationRepository = testApp.module.get(ExperimentVisualizationRepository);
    experimentRepository = testApp.module.get(ExperimentRepository);

    vi.restoreAllMocks();
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

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
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

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
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

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
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
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      // Mock experiment access to return null experiment (experiment doesn't exist)
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: null,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${experiment.id} not found`);
    });

    it("should fail when user does not have access to experiment", async () => {
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
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      // Mock experiment access to return experiment but no access
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { ...experiment, createdBy: "another-user-id" },
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
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

      // Mock experiment access with regular member privileges (not admin)
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false, // Not an admin, just a regular member
        }),
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

      // Mock experimentRepository.checkAccess to return archived experiment
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { ...experiment, status: "archived" },
          hasAccess: true,
          hasArchiveAccess: false,
          isAdmin: true,
        }),
      );

      try {
        // Act
        const result = await useCase.execute(visualizationId, testUserId);

        // Assert
        expect(result.isFailure()).toBe(true);
        assertFailure(result);
        expect(result.error.message).toContain("You do not have access to this experiment");
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
