import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
    const experimentId = faker.string.uuid();

    it("should successfully list visualizations", async () => {
      // Arrange
      const mockVisualizations = [
        {
          id: faker.string.uuid(),
          experimentId,
          name: "Visualization 1",
          type: "bar",
          dataConfig: { table: "test_table", columns: ["col1", "col2"] },
          visualConfig: { title: "Visualization 1" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: faker.string.uuid(),
          experimentId,
          name: "Visualization 2",
          type: "line",
          dataConfig: { table: "test_table", columns: ["col1", "col3"] },
          visualConfig: { title: "Visualization 2" },
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

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

      vi.spyOn(experimentVisualizationRepository, "listVisualizations").mockResolvedValue(
        success(mockVisualizations),
      );

      // Act
      const result = await useCase.execute(experimentId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({
        id: mockVisualizations[0].id,
        experimentId,
        name: mockVisualizations[0].name,
        type: mockVisualizations[0].type,
      });
      expect(result.value[1]).toMatchObject({
        id: mockVisualizations[1].id,
        experimentId,
        name: mockVisualizations[1].name,
        type: mockVisualizations[1].type,
      });
    });

    it("should return empty array when there are no visualizations", async () => {
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

      vi.spyOn(experimentVisualizationRepository, "listVisualizations").mockResolvedValue(
        success([]),
      );

      // Act
      const result = await useCase.execute(experimentId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
      expect(result.value).toEqual([]);
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
      const result = await useCase.execute(experimentId, testUserId);

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
      const result = await useCase.execute(experimentId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("You do not have access to this experiment");
    });

    it("should fail when repository throws an error", async () => {
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

      vi.spyOn(experimentVisualizationRepository, "listVisualizations").mockResolvedValue(
        failure({
          message: "Database error",
          code: "DATABASE_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      // Act
      const result = await useCase.execute(experimentId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe("Failed to retrieve experiment visualizations");
    });
  });
});
