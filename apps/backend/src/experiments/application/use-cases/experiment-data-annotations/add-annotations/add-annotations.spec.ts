import type { AddAnnotationsBulkBody } from "@repo/api";

import { DatabricksAdapter } from "../../../../../common/modules/databricks/databricks.adapter";
import {
  assertFailure,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { AddAnnotationsUseCase } from "./add-annotations";

describe("AddAnnotations", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddAnnotationsUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(AddAnnotationsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add an annotation to experiment data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock DatabricksAdapter - first listTables shows no annotations table exists
    vi.spyOn(databricksAdapter, "listTables").mockResolvedValueOnce(
      success({
        tables: [], // No annotations table exists
        next_page_token: undefined,
      }),
    );

    vi.spyOn(databricksAdapter, "executeExperimentSqlQuery")
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // CREATE TABLE
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // ALTER TABLE
      .mockResolvedValueOnce(
        success({
          columns: [
            { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
            { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
          ],
          rows: [["2", "2"]],
          totalRows: 1,
          truncated: false,
        }),
      ); // INSERT

    // Mock the refresh silver data call
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      success({
        update_id: "mock-update-id",
      }),
    );

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is success
    if (result.isFailure()) {
      console.log("Test failed with error:", result.error);
    }
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    expect(result.value).toStrictEqual({ rowsAffected: 2 });
  });

  it("should return bad request error when user ID is missing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act - pass empty string as userId
    const result = await useCase.execute(experiment.id, newAnnotation, "");

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(nonExistentId, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Experiment with ID ${nonExistentId} not found`);
  });

  it("should return forbidden error when user does not have access to private experiment", async () => {
    // Create experiment with another user
    const otherUserId = await testApp.createTestUser({
      email: "other@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      description: "Private experiment",
      status: "active",
      visibility: "private", // Important: set to private
      userId: otherUserId, // Created by another user
    });

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should handle Databricks service errors appropriately when ensuring the annotations table exists", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock listTables to show no annotations table exists
    vi.spyOn(databricksAdapter, "listTables").mockResolvedValueOnce(
      success({
        tables: [],
        next_page_token: undefined,
      }),
    );

    // Mock table creation to fail
    vi.spyOn(databricksAdapter, "executeExperimentSqlQuery").mockResolvedValue(
      failure({
        message: "Databricks SQL query execution failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "DatabricksError",
      }),
    );

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain(
      "Failed to create annotations table: Databricks SQL query execution",
    );
  });

  it("should handle Databricks service errors appropriately when inserting data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock listTables to show no annotations table exists
    vi.spyOn(databricksAdapter, "listTables").mockResolvedValueOnce(
      success({
        tables: [],
        next_page_token: undefined,
      }),
    );

    // Mock table creation and alter to succeed, then insert to fail
    vi.spyOn(databricksAdapter, "executeExperimentSqlQuery")
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // CREATE TABLE
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // ALTER TABLE
      .mockResolvedValue(
        failure({
          message: "Databricks SQL query execution failed",
          code: "DATABRICKS_ERROR",
          statusCode: 500,
          name: "DatabricksError",
        }),
      ); // INSERT fails

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain(
      "Failed to insert annotations: Databricks SQL query execution",
    );
  });

  it("should add flag annotation to experiment data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-flag",
      status: "active",
    });

    // Mock listTables to show no annotations table exists
    vi.spyOn(databricksAdapter, "listTables").mockResolvedValueOnce(
      success({
        tables: [],
        next_page_token: undefined,
      }),
    );

    // Mock DatabricksAdapter methods
    vi.spyOn(databricksAdapter, "executeExperimentSqlQuery")
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // CREATE TABLE
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // ALTER TABLE
      .mockResolvedValueOnce(
        success({
          columns: [
            { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
            { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
          ],
          rows: [["2", "2"]],
          totalRows: 1,
          truncated: false,
        }),
      ); // INSERT

    // Mock the refresh silver data call
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      success({ update_id: "mock-update-id" }),
    );

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "flag",
        content: {
          type: "flag",
          flagType: "outlier",
          text: "This data point is an outlier",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(2);
  });

  it("should continue operation when silver data refresh fails", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-refresh-fail",
      status: "active",
    });

    // Mock listTables to show no annotations table exists
    vi.spyOn(databricksAdapter, "listTables").mockResolvedValueOnce(
      success({
        tables: [],
        next_page_token: undefined,
      }),
    );

    // Mock DatabricksAdapter methods
    vi.spyOn(databricksAdapter, "executeExperimentSqlQuery")
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // CREATE TABLE
      .mockResolvedValueOnce(
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      ) // ALTER TABLE
      .mockResolvedValueOnce(
        success({
          columns: [
            { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
            { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
          ],
          rows: [["1", "1"]],
          totalRows: 1,
          truncated: false,
        }),
      ); // INSERT

    // Mock the refresh silver data call to fail (should still continue)
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      failure({
        message: "Pipeline update failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert - operation should still succeed despite refresh failure
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should skip table creation when annotations table already exists", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-existing-table",
      status: "active",
    });

    // Mock listTables to show annotations table already exists
    vi.spyOn(databricksAdapter, "listTables").mockResolvedValueOnce(
      success({
        tables: [
          {
            name: "annotations",
            catalog_name: "test_catalog",
            schema_name: "test_schema",
            table_type: "MANAGED",
            created_at: Date.now(),
          },
          {
            name: "other_table",
            catalog_name: "test_catalog",
            schema_name: "test_schema",
            table_type: "MANAGED",
            created_at: Date.now(),
          },
        ],
        next_page_token: undefined,
      }),
    );

    // Mock only the INSERT operation (no CREATE/ALTER since table exists)
    vi.spyOn(databricksAdapter, "executeExperimentSqlQuery").mockResolvedValueOnce(
      success({
        columns: [
          { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
          { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
        ],
        rows: [["1", "1"]],
        totalRows: 1,
        truncated: false,
      }),
    ); // INSERT

    // Mock the refresh silver data call
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      success({ update_id: "mock-update-id" }),
    );

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment for existing table",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert - operation should succeed and only call INSERT, not CREATE/ALTER
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);

    // Verify that executeExperimentSqlQuery was called only once (for INSERT)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksAdapter.executeExperimentSqlQuery).toHaveBeenCalledTimes(1);
  });
});
