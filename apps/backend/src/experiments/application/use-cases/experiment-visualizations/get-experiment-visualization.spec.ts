import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { GetExperimentVisualizationUseCase } from "./get-experiment-visualization";

describe("GetExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentVisualizationUseCase;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentVisualizationUseCase);
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

    it("should successfully get a visualization", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success({
          id: visualizationId,
          experimentId: experiment.id,
          name: "Test Visualization",
          description: null,
          chartFamily: "basic",
          chartType: "bar",
          dataConfig: { tableName: "test_table", dataSources: [] },
          config: { title: "Test Visualization" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        experimentId: experiment.id,
        name: "Test Visualization",
        chartFamily: "basic",
        chartType: "bar",
      });
    });

    it("should fail when visualization does not exist", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        failure({
          message: "Visualization not found",
          code: "NOT_FOUND",
          statusCode: 404,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment visualization");
    });

    it("should fail when visualization belongs to a different experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      const differentExperimentId = faker.string.uuid();

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success({
          id: visualizationId,
          experimentId: differentExperimentId, // Different experiment ID
          name: "Test Visualization",
          description: null,
          chartFamily: "basic" as const,
          chartType: "bar" as const,
          dataConfig: { tableName: "test_table", dataSources: [] },
          config: { title: "Test Visualization" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(
        `Visualization with ID ${visualizationId} not found in this experiment`,
      );
    });

    it("should fail when visualization findById returns success with null", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Mock findById to return success with null (instead of failure)
      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(success(null));

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Visualization with ID ${visualizationId} not found`);
    });
  });
});
