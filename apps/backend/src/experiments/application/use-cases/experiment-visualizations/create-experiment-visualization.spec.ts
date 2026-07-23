import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { CreateExperimentVisualizationUseCase } from "./create-experiment-visualization";

describe("CreateExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentVisualizationUseCase;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentVisualizationUseCase);
    experimentVisualizationRepository = testApp.module.get(ExperimentVisualizationRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    const mockRequest: CreateExperimentVisualizationDto = {
      name: "Test Visualization",
      chartFamily: "basic" as const,
      chartType: "bar" as const,
      dataConfig: {
        tableName: "test_table",
        dataSources: [
          {
            tableName: "test_table",
            columnName: "col1",
            alias: "X Column",
            role: "x",
          },
          {
            tableName: "test_table",
            columnName: "col2",
            alias: "Y Column",
            role: "y",
          },
        ],
      },
      config: {
        chartType: "bar" as const,
        config: {
          xAxis: {
            dataSource: {
              tableName: "test_table",
              columnName: "col1",
            },
            type: "category" as const,
            title: "X Axis",
          },
          yAxes: [
            {
              dataSource: {
                tableName: "test_table",
                columnName: "col2",
              },
              type: "linear" as const,
              title: "Y Axis",
            },
          ],
          orientation: "vertical" as const,
          barMode: "overlay" as const,
          barWidth: 0.7,
          gridLines: "both" as const,
          showValues: false,
          display: {
            title: "Test Visualization",
            showLegend: true,
            legendPosition: "right" as const,
            colorScheme: "default" as const,
            interactive: true,
          },
        },
      },
    };

    const visualizationId = faker.string.uuid();

    it("should successfully create a visualization", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const createVisualizationSpy = vi
        .spyOn(experimentVisualizationRepository, "create")
        .mockResolvedValue(
          success([
            {
              id: visualizationId,
              experimentId: experiment.id,
              name: mockRequest.name,
              description: null,
              chartFamily: mockRequest.chartFamily,
              chartType: mockRequest.chartType,
              config: mockRequest.config,
              dataConfig: mockRequest.dataConfig,
              createdBy: testUserId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        );

      // Act
      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        experimentId: experiment.id,
        name: mockRequest.name,
        chartFamily: mockRequest.chartFamily,
        chartType: mockRequest.chartType,
        config: mockRequest.config,
        dataConfig: mockRequest.dataConfig,
        createdBy: testUserId,
      });

      expect(createVisualizationSpy).toHaveBeenCalledWith(experiment.id, mockRequest, testUserId);
    });

    it("should fail when visualization name is not provided", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const invalidRequest = { ...mockRequest, name: "" };

      // Act
      const result = await useCase.execute(experiment.id, invalidRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Visualization name is required");
    });

    it("should fail when experiment does not exist", async () => {
      // Arrange
      const nonExistentExperimentId = faker.string.uuid();

      // Act
      const result = await useCase.execute(nonExistentExperimentId, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should fail when experiment is archived", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        status: "archived",
        userId: testUserId,
      });

      // Act
      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Cannot modify an archived experiment");
    });

    it("should fail when repository create operation fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      vi.spyOn(experimentVisualizationRepository, "create").mockResolvedValue(
        success([]), // Empty array indicates creation failure
      );

      // Act
      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to create visualization");
    });

    it("should forbid any user from creating visualizations for archived experiments", async () => {
      // Create an archived experiment
      const { experiment } = await testApp.createExperiment({
        name: "Archived Experiment",
        status: "archived",
        userId: testUserId,
      });

      // Act
      const result = await useCase.execute(experiment.id, mockRequest, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Cannot modify an archived experiment");
    });
  });
});
