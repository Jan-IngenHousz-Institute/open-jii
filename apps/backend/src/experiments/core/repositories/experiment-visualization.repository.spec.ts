import { faker } from "@faker-js/faker";

import { assertSuccess, assertFailure } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type {
  CreateExperimentVisualizationDto,
  UpdateExperimentVisualizationDto,
  ExperimentVisualizationDto,
} from "../models/experiment-visualizations.model";
import { ExperimentVisualizationRepository } from "./experiment-visualization.repository";

describe("ExperimentVisualizationRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentVisualizationRepository;
  let testUserId: string;
  let anotherUserId: string;
  let testExperimentId: string;
  let anotherExperimentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: "Test User" });
    anotherUserId = await testApp.createTestUser({ name: "Another User" });

    // Create test experiments
    const testExperiment = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    testExperimentId = testExperiment.experiment.id;

    const anotherExperiment = await testApp.createExperiment({
      name: "Another Experiment",
      userId: anotherUserId,
    });
    anotherExperimentId = anotherExperiment.experiment.id;

    repository = testApp.module.get(ExperimentVisualizationRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new experiment visualization", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Test Visualization",
        description: "Test Description",
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
      };

      // Act
      const result = await repository.create(testExperimentId, createDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const visualizations = result.value;
      const visualization = visualizations[0];

      expect(visualization).toMatchObject({
        id: expect.any(String) as string,
        name: createDto.name,
        description: createDto.description,
        experimentId: testExperimentId,
        chartFamily: createDto.chartFamily,
        chartType: createDto.chartType,
        config: createDto.config,
        dataConfig: createDto.dataConfig,
        createdBy: testUserId,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
      });

      // Additional verification through repository methods
      const findResult = await repository.findById(visualization.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: createDto.name,
        description: createDto.description,
        experimentId: testExperimentId,
        chartFamily: createDto.chartFamily,
        chartType: createDto.chartType,
        createdBy: testUserId,
      });
    });

    it("should create a visualization with null description", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Visualization Without Description",
        description: undefined,
        chartFamily: "scientific",
        chartType: "scatter",
        config: {
          chartType: "scatter",
          config: {
            xAxis: {
              dataSource: { tableName: "test_table", columnName: "x_column" },
            },
            yAxes: [{ dataSource: { tableName: "test_table", columnName: "y_column" } }],
          },
        },
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x_column" },
            { tableName: "test_table", columnName: "y_column" },
          ],
        },
      };

      // Act
      const result = await repository.create(testExperimentId, createDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const visualization = result.value[0];

      expect(visualization).toMatchObject({
        name: createDto.name,
        description: null,
        experimentId: testExperimentId,
        chartFamily: createDto.chartFamily,
        chartType: createDto.chartType,
        createdBy: testUserId,
      });
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Test Visualization",
        description: "Test Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      // Use invalid experiment ID that violates foreign key constraint
      const invalidExperimentId = faker.string.uuid();

      // Act
      const result = await repository.create(invalidExperimentId, createDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("listVisualizations", () => {
    it("should return empty array when no visualizations exist", async () => {
      // Act
      const result = await repository.listVisualizations(testExperimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should list visualizations for a specific experiment", async () => {
      // Arrange
      const createDto1: CreateExperimentVisualizationDto = {
        name: "First Visualization",
        description: "First Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "table1", dataSources: [] },
      };

      const createDto2: CreateExperimentVisualizationDto = {
        name: "Second Visualization",
        description: "Second Description",
        chartFamily: "statistical",
        chartType: "histogram",
        config: { chartType: "histogram", config: {} },
        dataConfig: { tableName: "table2", dataSources: [] },
      };

      // Create visualizations
      await repository.create(testExperimentId, createDto1, testUserId);
      await repository.create(testExperimentId, createDto2, testUserId);

      // Create visualization in different experiment (should not be returned)
      await repository.create(anotherExperimentId, createDto1, anotherUserId);

      // Act
      const result = await repository.listVisualizations(testExperimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const visualizations = result.value;
      expect(visualizations[0].name).toBe("Second Visualization"); // Most recent first (desc order)
      expect(visualizations[1].name).toBe("First Visualization");

      // All should belong to the same experiment
      visualizations.forEach((viz) => {
        expect(viz.experimentId).toBe(testExperimentId);
      });
    });

    it("should order visualizations by creation date descending", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Test Visualization",
        description: "Test Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      // Create multiple visualizations with different names
      const _firstResult = await repository.create(
        testExperimentId,
        {
          ...createDto,
          name: "First Created",
        },
        testUserId,
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const _secondResult = await repository.create(
        testExperimentId,
        {
          ...createDto,
          name: "Second Created",
        },
        testUserId,
      );

      // Act
      const result = await repository.listVisualizations(testExperimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const visualizations = result.value;
      // Should be ordered by creation date descending (newest first)
      expect(visualizations[0].name).toBe("Second Created");
      expect(visualizations[1].name).toBe("First Created");
      expect(visualizations[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        visualizations[1].createdAt.getTime(),
      );
    });
  });

  describe("findById", () => {
    it("should return null when visualization does not exist", async () => {
      // Arrange
      const nonExistentId = faker.string.uuid();

      // Act
      const result = await repository.findById(nonExistentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should find and return visualization by ID", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Test Visualization",
        description: "Test Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const createdVisualization = createResult.value[0];

      // Act
      const result = await repository.findById(createdVisualization.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value).toMatchObject({
        id: createdVisualization.id,
        name: createDto.name,
        description: createDto.description,
        experimentId: testExperimentId,
        chartFamily: createDto.chartFamily,
        chartType: createDto.chartType,
        createdBy: testUserId,
      });
    });

    it("should handle database errors gracefully", async () => {
      // Arrange - Use an invalid UUID format to trigger a database error
      const invalidId = "not-a-valid-uuid";

      // Act
      const result = await repository.findById(invalidId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update an existing visualization", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Original Name",
        description: "Original Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "original_table", dataSources: [] },
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const visualization = createResult.value[0];

      const updateDto: UpdateExperimentVisualizationDto = {
        name: "Updated Name",
        description: "Updated Description",
        chartFamily: "statistical",
        chartType: "histogram",
        config: { chartType: "histogram", config: { nbins: 20 } },
        dataConfig: { tableName: "updated_table", dataSources: [] },
      };

      // Act
      const result = await repository.update(visualization.id, updateDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updatedVisualizations = result.value;
      const updatedVisualization = updatedVisualizations[0];

      expect(updatedVisualization).toMatchObject({
        id: visualization.id,
        name: updateDto.name,
        description: updateDto.description,
        chartFamily: updateDto.chartFamily,
        chartType: updateDto.chartType,
        config: updateDto.config,
        dataConfig: updateDto.dataConfig,
        experimentId: testExperimentId,
        createdBy: testUserId,
        createdAt: visualization.createdAt,
        updatedAt: expect.any(Date) as Date,
      });

      // Verify through repository
      const findUpdatedResult = await repository.findById(visualization.id);
      assertSuccess(findUpdatedResult);
      expect(findUpdatedResult.value).toMatchObject({
        name: updateDto.name,
        description: updateDto.description,
        chartFamily: updateDto.chartFamily,
        chartType: updateDto.chartType,
      });
    });

    it("should return empty array when updating non-existent visualization", async () => {
      // Arrange
      const nonExistentId = faker.string.uuid();
      const updateDto: UpdateExperimentVisualizationDto = {
        name: "Updated Name",
        description: "Updated Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      // Act
      const result = await repository.update(nonExistentId, updateDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should handle partial updates", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Original Name",
        description: "Original Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "original_table", dataSources: [] },
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const visualization = createResult.value[0];

      const partialUpdateDto = {
        name: "Updated Name Only",
      };

      // Act
      const result = await repository.update(visualization.id, partialUpdateDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updatedVisualization = result.value[0];

      expect(updatedVisualization.name).toBe("Updated Name Only");
      expect(updatedVisualization.description).toBe(createDto.description); // Should remain unchanged
      expect(updatedVisualization.chartFamily).toBe(createDto.chartFamily); // Should remain unchanged
    });

    it("should handle database errors gracefully", async () => {
      // Arrange - Use an invalid UUID format to trigger a database error
      const invalidId = "not-a-valid-uuid";
      const updateDto: UpdateExperimentVisualizationDto = {
        name: "Updated Name",
        description: "Updated Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      // Act
      const result = await repository.update(invalidId, updateDto);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("delete", () => {
    it("should delete an existing visualization", async () => {
      // Arrange
      const createDto: CreateExperimentVisualizationDto = {
        name: "Test Visualization",
        description: "Test Description",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const visualization = createResult.value[0];

      // Verify it exists before deletion
      const findBeforeResult = await repository.findById(visualization.id);
      assertSuccess(findBeforeResult);
      expect(findBeforeResult.value).not.toBeNull();

      // Act
      const result = await repository.delete(visualization.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();

      // Verify it no longer exists
      const findAfterResult = await repository.findById(visualization.id);
      assertSuccess(findAfterResult);
      expect(findAfterResult.value).toBeNull();

      // Verify through listVisualizations that it's gone
      const listResult = await repository.listVisualizations(testExperimentId);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(0);
    });

    it("should succeed when deleting non-existent visualization", async () => {
      // Arrange
      const nonExistentId = faker.string.uuid();

      // Act
      const result = await repository.delete(nonExistentId);

      // Assert - Should succeed even though nothing was deleted
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeUndefined();
    });

    it("should handle database errors gracefully", async () => {
      // Arrange - Use an invalid UUID format to trigger a database error
      const invalidId = "not-a-valid-uuid";

      // Act
      const result = await repository.delete(invalidId);

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error).toBeDefined();
    });
  });

  describe("integration tests", () => {
    it("should handle complete CRUD lifecycle", async () => {
      // Create
      const createDto: CreateExperimentVisualizationDto = {
        name: "Lifecycle Test Visualization",
        description: "Testing complete lifecycle",
        chartFamily: "basic",
        chartType: "bar",
        config: { chartType: "bar", config: {} },
        dataConfig: { tableName: "test_table", dataSources: [] },
      };

      const createResult = await repository.create(testExperimentId, createDto, testUserId);
      assertSuccess(createResult);
      const visualization = createResult.value[0];

      // Read
      const findResult = await repository.findById(visualization.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: createDto.name,
        description: createDto.description,
      });

      // List
      const listResult = await repository.listVisualizations(testExperimentId);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(1);
      expect(listResult.value[0].id).toBe(visualization.id);

      // Update
      const updateDto: UpdateExperimentVisualizationDto = {
        name: "Updated Lifecycle Visualization",
        description: "Updated description",
        chartFamily: "statistical",
        chartType: "histogram",
        config: { chartType: "histogram", config: { nbins: 30 } },
        dataConfig: { tableName: "updated_table", dataSources: [] },
      };

      const updateResult = await repository.update(visualization.id, updateDto);
      assertSuccess(updateResult);
      expect(updateResult.value[0]).toMatchObject({
        name: updateDto.name,
        description: updateDto.description,
        chartFamily: updateDto.chartFamily,
        chartType: updateDto.chartType,
      });

      // Verify update in list
      const listAfterUpdateResult = await repository.listVisualizations(testExperimentId);
      assertSuccess(listAfterUpdateResult);
      expect(listAfterUpdateResult.value[0]).toMatchObject({
        name: updateDto.name,
        description: updateDto.description,
      });

      // Delete
      const deleteResult = await repository.delete(visualization.id);
      assertSuccess(deleteResult);

      // Verify deletion
      const findAfterDeleteResult = await repository.findById(visualization.id);
      assertSuccess(findAfterDeleteResult);
      expect(findAfterDeleteResult.value).toBeNull();

      const listAfterDeleteResult = await repository.listVisualizations(testExperimentId);
      assertSuccess(listAfterDeleteResult);
      expect(listAfterDeleteResult.value).toHaveLength(0);
    });

    it("should maintain data integrity across multiple operations", async () => {
      // Create multiple visualizations
      const visualizations: ExperimentVisualizationDto[] = [];
      for (let i = 0; i < 3; i++) {
        const createDto: CreateExperimentVisualizationDto = {
          name: `Visualization ${i + 1}`,
          description: `Description for visualization ${i + 1}`,
          chartFamily: "basic",
          chartType: "bar",
          config: { chartType: "bar", config: { index: i } },
          dataConfig: { tableName: `table_${i}`, dataSources: [] },
        };

        const result = await repository.create(testExperimentId, createDto, testUserId);
        assertSuccess(result);
        visualizations.push(result.value[0]);
      }

      // Verify all created
      const listResult = await repository.listVisualizations(testExperimentId);
      assertSuccess(listResult);
      expect(listResult.value).toHaveLength(3);

      // Update middle one
      const updateResult = await repository.update(visualizations[1].id, {
        name: "Updated Middle Visualization",
      });
      assertSuccess(updateResult);

      // Delete first one
      const deleteResult = await repository.delete(visualizations[0].id);
      assertSuccess(deleteResult);

      // Verify final state
      const finalListResult = await repository.listVisualizations(testExperimentId);
      assertSuccess(finalListResult);
      expect(finalListResult.value).toHaveLength(2);

      const remainingNames = finalListResult.value.map((v) => v.name).sort();
      expect(remainingNames).toEqual(["Updated Middle Visualization", "Visualization 3"]);
    });
  });
});
