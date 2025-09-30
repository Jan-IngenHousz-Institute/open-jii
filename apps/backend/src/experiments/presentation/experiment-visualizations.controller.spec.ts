import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/create-experiment-visualization";
import { DeleteExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/delete-experiment-visualization";
import { GetExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/get-experiment-visualization";
import { ListExperimentVisualizationsUseCase } from "../application/use-cases/experiment-visualizations/list-experiment-visualizations";
import { UpdateExperimentVisualizationUseCase } from "../application/use-cases/experiment-visualizations/update-experiment-visualization";
import type { ExperimentVisualizationDto } from "../core/models/experiment-visualizations.model";

// Helper function to create test visualization data
const createTestVisualizationData = (overrides: Partial<any> = {}) => ({
  name: "Test Visualization",
  description: "Test Description",
  chartFamily: "basic" as const,
  chartType: "bar" as const,
  config: {
    chartType: "bar" as const,
    config: {
      xAxis: {
        dataSource: { tableName: "test_table", columnName: "column1" },
      },
      yAxes: [{ dataSource: { tableName: "test_table", columnName: "column2" } }],
    },
  },
  dataConfig: {
    tableName: "test_table",
    dataSources: [
      { tableName: "test_table", columnName: "column1" },
      { tableName: "test_table", columnName: "column2" },
    ],
  },
  ...overrides,
});

// Helper function to create mock visualization DTO
const createMockVisualizationDto = (
  experimentId: string,
  userId: string,
  overrides: Partial<ExperimentVisualizationDto> = {},
): ExperimentVisualizationDto => ({
  id: faker.string.uuid(),
  experimentId,
  name: "Test Visualization",
  chartFamily: "basic",
  chartType: "bar",
  config: {
    chartType: "bar",
    config: {
      xAxis: {
        dataSource: { tableName: "test_table", columnName: "column1" },
      },
      yAxes: [{ dataSource: { tableName: "test_table", columnName: "column2" } }],
    },
  },
  dataConfig: {
    tableName: "test_table",
    dataSources: [
      { tableName: "test_table", columnName: "column1" },
      { tableName: "test_table", columnName: "column2" },
    ],
  },
  createdBy: userId,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ExperimentVisualizationsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let listExperimentVisualizationsUseCase: ListExperimentVisualizationsUseCase;
  let createExperimentVisualizationUseCase: CreateExperimentVisualizationUseCase;
  let getExperimentVisualizationUseCase: GetExperimentVisualizationUseCase;
  let updateExperimentVisualizationUseCase: UpdateExperimentVisualizationUseCase;
  let deleteExperimentVisualizationUseCase: DeleteExperimentVisualizationUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get use case instances for mocking
    listExperimentVisualizationsUseCase = testApp.module.get(ListExperimentVisualizationsUseCase);
    createExperimentVisualizationUseCase = testApp.module.get(CreateExperimentVisualizationUseCase);
    getExperimentVisualizationUseCase = testApp.module.get(GetExperimentVisualizationUseCase);
    updateExperimentVisualizationUseCase = testApp.module.get(UpdateExperimentVisualizationUseCase);
    deleteExperimentVisualizationUseCase = testApp.module.get(DeleteExperimentVisualizationUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listVisualizations", () => {
    it("should successfully list experiment visualizations", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const mockVisualizations: ExperimentVisualizationDto[] = [
        createMockVisualizationDto(experimentId, testUserId, {
          name: "Test Visualization 1",
          chartType: "bar",
        }),
        createMockVisualizationDto(experimentId, testUserId, {
          name: "Test Visualization 2",
          chartType: "line",
        }),
      ];

      vi.spyOn(listExperimentVisualizationsUseCase, "execute").mockResolvedValue(
        success(mockVisualizations),
      );

      // Act
      const response = await testApp
        .get(contract.experiments.listExperimentVisualizations.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(2);
      const [firstViz, secondViz] = response.body as ExperimentVisualizationDto[];
      const [firstMock, secondMock] = mockVisualizations;
      expect(firstViz).toHaveProperty("id", firstMock.id);
      expect(firstViz).toHaveProperty("name", firstMock.name);
      expect(secondViz).toHaveProperty("id", secondMock.id);
      expect(secondViz).toHaveProperty("name", secondMock.name);
    });

    it("should handle errors when listing visualizations", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const errorMessage = "Experiment not found";

      vi.spyOn(listExperimentVisualizationsUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound(errorMessage)),
      );

      // Act & Assert
      await testApp
        .get(contract.experiments.listExperimentVisualizations.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("createVisualization", () => {
    it("should successfully create a visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationData = createTestVisualizationData({
        name: "New Visualization",
      });

      const mockVisualization = createMockVisualizationDto(experimentId, testUserId, {
        name: "New Visualization",
      });

      vi.spyOn(createExperimentVisualizationUseCase, "execute").mockResolvedValue(
        success(mockVisualization),
      );

      // Act
      const response = await testApp
        .post(contract.experiments.createExperimentVisualization.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .send(visualizationData)
        .expect(StatusCodes.CREATED);

      // Assert
      expect(response.body).toHaveProperty("id");
      expect(response.body).toMatchObject({
        name: visualizationData.name,
        chartType: visualizationData.chartType,
        chartFamily: visualizationData.chartFamily,
        experimentId,
        createdBy: testUserId,
      });
    });

    it("should handle validation errors when creating visualization", async () => {
      // Arrive
      const experimentId = faker.string.uuid();
      const invalidData = {
        // Missing required name field
        chartFamily: "basic",
        chartType: "bar",
        config: {
          chartType: "bar",
          config: {
            xAxis: { dataSource: { tableName: "test_table", columnName: "col1" } },
            yAxes: [{ dataSource: { tableName: "test_table", columnName: "col2" } }],
          },
        },
        dataConfig: {
          tableName: "test_table",
          dataSources: [{ tableName: "test_table", columnName: "col1" }],
        },
      };

      // Act & Assert
      await testApp
        .post(contract.experiments.createExperimentVisualization.path.replace(":id", experimentId))
        .withAuth(testUserId)
        .send(invalidData)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("getVisualization", () => {
    it("should successfully get a visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationId = faker.string.uuid();

      const mockVisualization = createMockVisualizationDto(experimentId, testUserId, {
        id: visualizationId,
        name: "Test Visualization",
      });

      vi.spyOn(getExperimentVisualizationUseCase, "execute").mockResolvedValue(
        success(mockVisualization),
      );

      // Act
      const response = await testApp
        .get(
          contract.experiments.getExperimentVisualization.path
            .replace(":id", experimentId)
            .replace(":visualizationId", visualizationId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toHaveProperty("id", visualizationId);
      expect(response.body).toHaveProperty("name", mockVisualization.name);
      expect(response.body).toHaveProperty("chartType", mockVisualization.chartType);
      expect(response.body).toHaveProperty("chartFamily", mockVisualization.chartFamily);
      expect(response.body).toHaveProperty("experimentId", experimentId);
    });

    it("should handle not found errors when getting visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationId = faker.string.uuid();
      const errorMessage = "Visualization not found";

      vi.spyOn(getExperimentVisualizationUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound(errorMessage)),
      );

      // Act & Assert
      await testApp
        .get(
          contract.experiments.getExperimentVisualization.path
            .replace(":id", experimentId)
            .replace(":visualizationId", visualizationId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("updateVisualization", () => {
    it("should successfully update a visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationId = faker.string.uuid();

      const updateData = createTestVisualizationData({
        name: "Updated Visualization",
        chartType: "line",
      });

      const mockUpdatedVisualization = createMockVisualizationDto(experimentId, testUserId, {
        id: visualizationId,
        name: "Updated Visualization",
        chartType: "line",
      });

      vi.spyOn(updateExperimentVisualizationUseCase, "execute").mockResolvedValue(
        success(mockUpdatedVisualization),
      );

      // Act
      const response = await testApp
        .patch(
          contract.experiments.updateExperimentVisualization.path
            .replace(":id", experimentId)
            .replace(":visualizationId", visualizationId),
        )
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toHaveProperty("id", visualizationId);
      expect(response.body).toHaveProperty("name", updateData.name);
      expect(response.body).toHaveProperty("chartType", updateData.chartType);
      expect(response.body).toHaveProperty("chartFamily", updateData.chartFamily);
    });

    it("should handle errors when updating visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationId = faker.string.uuid();

      const updateData = createTestVisualizationData({
        name: "Updated Visualization",
        chartType: "line",
      });

      const errorMessage = "You do not have permission to update this visualization";

      vi.spyOn(updateExperimentVisualizationUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden(errorMessage)),
      );

      // Act & Assert
      await testApp
        .patch(
          contract.experiments.updateExperimentVisualization.path
            .replace(":id", experimentId)
            .replace(":visualizationId", visualizationId),
        )
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.FORBIDDEN)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });

  describe("deleteVisualization", () => {
    it("should successfully delete a visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationId = faker.string.uuid();

      vi.spyOn(deleteExperimentVisualizationUseCase, "execute").mockResolvedValue(
        success(undefined),
      );

      // Act & Assert
      await testApp
        .delete(
          contract.experiments.deleteExperimentVisualization.path
            .replace(":id", experimentId)
            .replace(":visualizationId", visualizationId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.NO_CONTENT);
    });

    it("should handle errors when deleting visualization", async () => {
      // Arrange
      const experimentId = faker.string.uuid();
      const visualizationId = faker.string.uuid();
      const errorMessage = "Visualization not found";

      vi.spyOn(deleteExperimentVisualizationUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound(errorMessage)),
      );

      // Act & Assert
      await testApp
        .delete(
          contract.experiments.deleteExperimentVisualization.path
            .replace(":id", experimentId)
            .replace(":visualizationId", visualizationId),
        )
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toHaveProperty("message", errorMessage);
        });
    });
  });
});
