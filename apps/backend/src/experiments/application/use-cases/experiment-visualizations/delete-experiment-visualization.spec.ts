import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
      vi.spyOn(experimentVisualizationRepository, "existsInExperiment").mockResolvedValue(
        success(true),
      );

      vi.spyOn(experimentVisualizationRepository, "delete").mockResolvedValue(success(undefined));

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should fail when visualization does not exist", async () => {
      // Arrange
      vi.spyOn(experimentVisualizationRepository, "existsInExperiment").mockResolvedValue(
        failure({
          message: "Visualization not found",
          code: "NOT_FOUND",
          statusCode: 404,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(faker.string.uuid(), visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Visualization not found");
    });

    it("should fail when repository delete operation fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      vi.spyOn(experimentVisualizationRepository, "existsInExperiment").mockResolvedValue(
        success(true),
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
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to delete visualization");
    });

    it("should fail when visualization belongs to non-existent experiment", async () => {
      // Arrange
      const nonExistentExperimentId = faker.string.uuid();
      vi.spyOn(experimentVisualizationRepository, "existsInExperiment").mockResolvedValue(
        success(true),
      );

      // Act
      const result = await useCase.execute(nonExistentExperimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should return not found when no chart matches the experiment", async () => {
      vi.spyOn(experimentVisualizationRepository, "existsInExperiment").mockResolvedValue(
        success(false),
      );

      // Act
      const result = await useCase.execute(faker.string.uuid(), visualizationId, testUserId);

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

      vi.spyOn(experimentVisualizationRepository, "existsInExperiment").mockResolvedValue(
        success(true),
      );

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Cannot modify an archived experiment");
    });
  });
});
