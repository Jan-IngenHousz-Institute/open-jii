import { faker } from "@faker-js/faker";
import { Logger } from "@nestjs/common";

import { experimentVisualizations } from "@repo/database";

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

      vi.spyOn(experimentVisualizationRepository, "findReadableInExperiment").mockResolvedValue(
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

    it("should fail when the visualization lookup fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentVisualizationRepository, "findReadableInExperiment").mockResolvedValue(
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

    it.each([
      { kind: "valid", dataSources: [{ tableName: "test_table", columnName: "value", role: "y" }] },
      { kind: "malformed", dataSources: [] },
    ])("treats a $kind chart from another experiment as missing", async ({ dataSources }) => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });
      const otherUserId = await testApp.createTestUser({});
      const { experiment: otherExperiment } = await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });
      const missing = await useCase.execute(experiment.id, visualizationId, testUserId);
      assertFailure(missing);
      expect(missing.error).toMatchObject({
        statusCode: 404,
        message: `Visualization with ID ${visualizationId} not found`,
      });

      await testApp.database.insert(experimentVisualizations).values({
        id: visualizationId,
        experimentId: otherExperiment.id,
        name: "Saved chart",
        chartFamily: "basic",
        chartType: "bar",
        config: {},
        dataConfig: { tableName: "test_table", dataSources },
        createdBy: otherUserId,
      });
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      assertFailure(result);
      expect(result.error).toMatchObject({
        statusCode: missing.error.statusCode,
        message: missing.error.message,
      });
      expect(warn).not.toHaveBeenCalledWith(
        expect.objectContaining({ operation: "readExperimentVisualization" }),
      );
    });

    it("should fail when the visualization does not exist", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(experimentVisualizationRepository, "findReadableInExperiment").mockResolvedValue(
        success(null),
      );

      // Act
      const result = await useCase.execute(experiment.id, visualizationId, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toBe(`Visualization with ID ${visualizationId} not found`);
    });
  });
});
