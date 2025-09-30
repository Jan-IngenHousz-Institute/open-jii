import { faker } from "@faker-js/faker";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { UpdateExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { UpdateExperimentVisualizationUseCase } from "./update-experiment-visualization";

describe("UpdateExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentVisualizationUseCase;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;
  let experimentRepository: ExperimentRepository;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentVisualizationUseCase);
    experimentVisualizationRepository = testApp.module.get(ExperimentVisualizationRepository);
    experimentRepository = testApp.module.get(ExperimentRepository);
    databricksAdapter = testApp.module.get(DatabricksAdapter);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    const experimentId = faker.string.uuid();
    const visualizationId = faker.string.uuid();

    const mockVisualization = {
      id: visualizationId,
      experimentId,
      name: "Original Visualization",
      chartFamily: "plotly",
      chartType: "bar",
      dataConfig: { table: "test_table", columns: ["col1", "col2"] },
      config: { title: "Original Visualization" },
      createdBy: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdateRequest: UpdateExperimentVisualizationDto = {
      name: "Updated Visualization",
      chartFamily: "plotly",
      chartType: "line",
      dataConfig: { table: "test_table", columns: ["col1", "col3"] },
      config: { title: "Updated Visualization" },
    };

    it("should successfully update a visualization", async () => {
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Original Visualization",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: testUserId, // Now this matches the test user
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

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(success(true));

      const updatedVisualization = {
        ...mockVisualization,
        name: mockUpdateRequest.name,
        chartFamily: mockUpdateRequest.chartFamily,
        chartType: mockUpdateRequest.chartType,
        dataConfig: mockUpdateRequest.dataConfig,
        config: mockUpdateRequest.config,
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "update").mockResolvedValue(
        success([updatedVisualization]),
      );

      // Act
      const result = await useCase.execute(visualizationId, mockUpdateRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        experimentId,
        name: mockUpdateRequest.name,
        chartFamily: mockUpdateRequest.chartFamily,
        chartType: mockUpdateRequest.chartType,
      });
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
      const result = await useCase.execute(visualizationId, mockUpdateRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Visualization not found");
    });

    it("should fail when user is not the creator of the visualization", async () => {
      // Arrange
      const differentUserVisualization = {
        ...mockVisualization,
        createdBy: faker.string.uuid(), // Different user
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(differentUserVisualization),
      );

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { id: experimentId, name: "Test Experiment" },
          hasAccess: true,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, mockUpdateRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have permission to modify this visualization");
    });

    it("should fail when data source validation fails", async () => {
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Original Visualization",
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

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(
        failure({
          message: "Table not found",
          code: "INVALID_DATA_SOURCE",
          statusCode: 400,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, mockUpdateRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Table not found");
    });

    it("should fail when repository update operation fails", async () => {
      // Arrange
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Original Visualization",
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

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(success(true));

      vi.spyOn(experimentVisualizationRepository, "update").mockResolvedValue(
        failure({
          message: "Database error",
          code: "DATABASE_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(visualizationId, mockUpdateRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Database error");
    });

    it("should handle empty update successfully", async () => {
      // Arrange
      const emptyUpdate = {};
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Original Visualization",
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

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(success(true));

      vi.spyOn(experimentVisualizationRepository, "update").mockResolvedValue(
        success([mockVisualization]),
      );

      // Act
      const result = await useCase.execute(
        visualizationId,
        emptyUpdate as UpdateExperimentVisualizationDto,
        testUserId,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        experimentId,
      });
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

      const updateData: UpdateExperimentVisualizationDto = {
        name: "Updated Visualization",
        chartFamily: "basic",
        chartType: "line",
        config: { chartType: "line", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
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
      const result = await useCase.execute(visualizationId, updateData, testUserId);

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

      const updateData: UpdateExperimentVisualizationDto = {
        name: "Updated Visualization",
        chartFamily: "basic",
        chartType: "line",
        config: { chartType: "line", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
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
      const result = await useCase.execute(visualizationId, updateData, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should allow admin to update visualization even if not creator", async () => {
      // Arrange
      const otherUserId = faker.string.uuid();
      const mockVisualization = {
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
        createdBy: otherUserId, // Different user created it
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
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateData: UpdateExperimentVisualizationDto = {
        name: "Updated Visualization",
        chartFamily: "basic",
        chartType: "line",
        config: { chartType: "line", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      const updatedVisualization = {
        ...mockVisualization,
        ...updateData,
        updatedAt: new Date(),
      };

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success(mockVisualization),
      );

      // Mock experiment access with admin privileges
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: mockExperiment,
          hasAccess: true,
          isAdmin: true, // User is admin
        }),
      );

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(success(true));

      vi.spyOn(experimentVisualizationRepository, "update").mockResolvedValue(
        success([updatedVisualization]),
      );

      // Act
      const result = await useCase.execute(visualizationId, updateData, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        name: "Updated Visualization",
        chartType: "line",
      });
    });

    it("should fail when repository update returns empty array", async () => {
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

      const updateData: UpdateExperimentVisualizationDto = {
        name: "Updated Visualization",
        chartFamily: "basic",
        chartType: "line",
        config: { chartType: "line", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
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

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(success(true));

      // Mock repository to return empty array (no visualization was updated)
      vi.spyOn(experimentVisualizationRepository, "update").mockResolvedValue(success([]));

      // Act
      const result = await useCase.execute(visualizationId, updateData, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to update visualization");
    });

    it("should fail when visualization findById returns success with null", async () => {
      // Arrange - Mock findById to return success with null (instead of failure)
      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(success(null));

      const updateData: UpdateExperimentVisualizationDto = {
        name: "Updated Name",
        chartFamily: "basic",
        chartType: "bar",
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      // Act
      const result = await useCase.execute(visualizationId, updateData, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      // This should hit the visualization null check (lines 37-39)
      expect(result.error.message).toBe(`Visualization with ID ${visualizationId} not found`);
    });
  });
});
