import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
    const experimentId = faker.string.uuid();

    it("should successfully delete a visualization", async () => {
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic" as const,
        chartType: "bar" as const,
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
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: null,
            status: "active" as const,
            visibility: "private" as const,
            embargoUntil: new Date(),
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
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
      // Arrange
      const differentUserVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic" as "basic" | "scientific" | "3d" | "statistical",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: faker.string.uuid(), // Different user
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(differentUserVisualization),
      );

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: null,
            status: "active",
            visibility: "private",
            embargoUntil: new Date(),
            createdBy: "other-user-id",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
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
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
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
          experiment: { id: experimentId, name: "Test Experiment" },
          hasAccess: true,
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
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
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
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${experimentId} not found`);
    });

    it("should fail when user does not have access to experiment", async () => {
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockExperiment = {
        id: experimentId,
        name: "Test Experiment",
        description: "Test Description",
        status: "active",
        visibility: "private",
        embargoUntil: new Date(),
        createdBy: "other-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      // Mock experiment access to return experiment but no access
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: mockExperiment,
          hasAccess: false,
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
      // Arrange
      const otherUserId = faker.string.uuid();
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
        description: null,
        chartFamily: "basic" as const,
        chartType: "bar" as const,
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
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: null,
            status: "active" as const,
            visibility: "private" as const,
            embargoUntil: new Date(),
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
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
  });
});
