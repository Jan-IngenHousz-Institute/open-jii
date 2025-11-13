import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentVisualizationDto } from "../../../core/models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "../../../core/repositories/experiment-visualization.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { GetExperimentVisualizationUseCase } from "./get-experiment-visualization";

describe("GetExperimentVisualizationUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentVisualizationUseCase;
  let experimentRepository: ExperimentRepository;
  let experimentVisualizationRepository: ExperimentVisualizationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentVisualizationUseCase);
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
    const visualizationId = faker.string.uuid();

    it("should successfully get a visualization", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

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
        } as ExperimentVisualizationDto),
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
      const result = await useCase.execute(nonExistentExperimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Experiment with ID ${nonExistentExperimentId} not found`);
    });

    it("should fail when user does not have access to the experiment", async () => {
      // Arrange
      const { experiment: inaccessibleExperiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: await testApp.createTestUser({}),
      });

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: inaccessibleExperiment,
          hasAccess: false,
          hasArchiveAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(inaccessibleExperiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when visualization does not exist", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

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

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: true,
        }),
      );

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
        } as ExperimentVisualizationDto),
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

      // Arrange - Experiment access should pass
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment,
          hasAccess: true,
          hasArchiveAccess: true,
          isAdmin: false,
        }),
      );

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
