import { faker } from "@faker-js/faker";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { CreateExperimentVisualizationUseCase } from "./create-experiment-visualization";

describe("CreateExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentVisualizationUseCase;
  let experimentRepository: ExperimentRepository;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentVisualizationUseCase);
    experimentRepository = testApp.module.get(ExperimentRepository);
    experimentVisualizationRepository = testApp.module.get(ExperimentVisualizationRepository);
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

    const experimentId = faker.string.uuid();
    const visualizationId = faker.string.uuid();

    it("should successfully create a visualization", async () => {
      // Arrange
      const checkAccessSpy = vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            embargoUntil: new Date(),
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
          isAdmin: true,
        }),
      );

      const validateDataSourcesSpy = vi
        .spyOn(databricksAdapter, "validateDataSources")
        .mockResolvedValue(success(true));

      const createVisualizationSpy = vi
        .spyOn(experimentVisualizationRepository, "create")
        .mockResolvedValue(
          success([
            {
              id: visualizationId,
              experimentId,
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
      const result = await useCase.execute(experimentId, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        experimentId,
        name: mockRequest.name,
        chartFamily: mockRequest.chartFamily,
        chartType: mockRequest.chartType,
        config: mockRequest.config,
        dataConfig: mockRequest.dataConfig,
        createdBy: testUserId,
      });

      expect(checkAccessSpy).toHaveBeenCalledWith(experimentId, testUserId);
      expect(validateDataSourcesSpy).toHaveBeenCalledWith(
        mockRequest.dataConfig,
        "Test Experiment",
        experimentId,
      );
      expect(createVisualizationSpy).toHaveBeenCalledWith(experimentId, mockRequest, testUserId);
    });

    it("should fail when visualization name is not provided", async () => {
      // Arrange
      const invalidRequest = { ...mockRequest, name: "" };

      // Act
      const result = await useCase.execute(experimentId, invalidRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Visualization name is required");
    });

    it("should fail when experiment does not exist", async () => {
      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: null,
          hasAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${experimentId} not found`);
    });

    it("should fail when user does not have access to the experiment", async () => {
      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            embargoUntil: new Date(),
            createdBy: faker.string.uuid(), // Different user
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when data source validation fails", async () => {
      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            embargoUntil: new Date(),
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(
        failure({
          message: "Table test_table does not exist",
          code: "INVALID_DATA_SOURCE",
          statusCode: 400,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Table test_table does not exist");
    });

    it("should fail when repository create operation fails", async () => {
      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            embargoUntil: new Date(),
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(databricksAdapter, "validateDataSources").mockResolvedValue(success(true));

      vi.spyOn(experimentVisualizationRepository, "create").mockResolvedValue(
        success([]), // Empty array indicates creation failure
      );

      // Act
      const result = await useCase.execute(experimentId, mockRequest, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to create visualization");
    });
  });
});
