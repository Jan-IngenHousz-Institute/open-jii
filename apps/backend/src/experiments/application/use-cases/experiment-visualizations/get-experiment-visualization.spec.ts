import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
    const experimentId = faker.string.uuid();
    const visualizationId = faker.string.uuid();

    it("should successfully get a visualization", async () => {
      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success({
          id: visualizationId,
          experimentId,
          name: "Test Visualization",
          type: "bar",
          dataConfig: { table: "test_table", columns: ["col1", "col2"] },
          visualConfig: { title: "Test Visualization" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: visualizationId,
        experimentId,
        name: "Test Visualization",
        type: "bar",
      });
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
      const result = await useCase.execute(experimentId, visualizationId, testUserId);

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
            createdBy: faker.string.uuid(), // Different user
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: false,
          isAdmin: false,
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when visualization does not exist", async () => {
      // Arrange
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
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
      const result = await useCase.execute(experimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment visualization");
    });

    it("should fail when visualization belongs to a different experiment", async () => {
      // Arrange
      const differentExperimentId = faker.string.uuid();

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active",
            visibility: "private",
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
          isAdmin: true,
        }),
      );

      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(
        success({
          id: visualizationId,
          experimentId: differentExperimentId, // Different experiment ID
          name: "Test Visualization",
          type: "bar",
          dataConfig: { table: "test_table", columns: ["col1", "col2"] },
          visualConfig: { title: "Test Visualization" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(
        `Visualization with ID ${visualizationId} not found in this experiment`,
      );
    });

    it("should fail when visualization findById returns success with null", async () => {
      // Arrange - Experiment access should pass
      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: {
            id: experimentId,
            name: "Test Experiment",
            description: "Test Description",
            status: "active" as const,
            visibility: "public" as const, // Public so access check passes
            embargoUntil: new Date(),
            createdBy: testUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          hasAccess: true,
          isAdmin: false,
        }),
      );

      // Mock findById to return success with null (instead of failure)
      vi.spyOn(experimentVisualizationRepository, "findById").mockResolvedValue(success(null));

      // Act
      const result = await useCase.execute(experimentId, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      // This should hit the visualization null check (lines 68-70)
      expect(result.error.message).toBe(`Visualization with ID ${visualizationId} not found`);
    });
  });
});
