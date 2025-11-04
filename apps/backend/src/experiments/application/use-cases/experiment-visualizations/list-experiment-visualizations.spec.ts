import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ListExperimentVisualizationsUseCase } from "./list-experiment-visualizations";

describe("ListExperimentVisualizationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExperimentVisualizationsUseCase;
  let experimentRepository: ExperimentRepository;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExperimentVisualizationsUseCase);
    experimentRepository = testApp.module.get(ExperimentRepository);
    experimentVisualizationRepository = testApp.module.get(ExperimentVisualizationRepository);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should successfully list visualizations", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const mockVisualizations: ExperimentVisualizationDto[] = [
        {
          id: faker.string.uuid(),
          experimentId: experiment.id,
          name: "Visualization 1",
          chartFamily: "basic",
          chartType: "bar",
          description: null,
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", role: "x", columnName: "col1" },
              { tableName: "test_table", role: "y", columnName: "col2" },
            ],
          },
          config: { title: "Visualization 1" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: faker.string.uuid(),
          experimentId: experiment.id,
          name: "Visualization 2",
          chartFamily: "basic",
          chartType: "line",
          description: null,
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", role: "x", columnName: "col1" },
              { tableName: "test_table", role: "y", columnName: "col3" },
            ],
          },
          config: { title: "Visualization 2" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          isAdmin: true,
          hasArchiveAccess: true,
        }),
      );

      vi.spyOn(experimentVisualizationRepository, "listVisualizations").mockResolvedValue(
        success(mockVisualizations),
      );

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({
        id: mockVisualizations[0].id,
        experimentId: experiment.id,
        name: mockVisualizations[0].name,
        chartType: mockVisualizations[0].chartType,
      });
      expect(result.value[1]).toMatchObject({
        id: mockVisualizations[1].id,
        experimentId: experiment.id,
        name: mockVisualizations[1].name,
        chartType: mockVisualizations[1].chartType,
      });
    });

    it("should return empty array when there are no visualizations", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentVisualizationRepository, "listVisualizations").mockResolvedValue(
        success([]),
      );

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
      expect(result.value).toEqual([]);
    });

    it("should fail when experiment does not exist", async () => {
      // Arrange
      const nonExistentExperimentId = faker.string.uuid();

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: null,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(nonExistentExperimentId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should fail when user does not have access to the experiment", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when repository throws an error", async () => {
      // Arrange
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentVisualizationRepository, "listVisualizations").mockResolvedValue(
        failure({
          message: "Database error",
          code: "DATABASE_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment visualizations");
    });
  });
});
