import nock from "nock";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentDataUseCase } from "./get-experiment-data";

const DATABRICKS_HOST = "https://test-databricks.example.com";

describe("GetExperimentDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentDataUseCase;
  // Define constants for Databricks mock values to ensure consistency
  const MOCK_WAREHOUSE_ID = "test-warehouse-id";
  const MOCK_CATALOG_NAME = "test_catalog";
  const MOCK_WAIT_TIMEOUT = "50s";
  const MOCK_DISPOSITION = "INLINE";
  const MOCK_FORMAT = "JSON_ARRAY";
  const SAMPLE_DATA_LIMIT = 5; // Assuming a default limit for sample data

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentDataUseCase);

    // Reset any mocks before each test
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return table data when table name is specified", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      embargoIntervalDays: 90,
      userId: testUserId,
    });

    // Mock the DatabricksService methods
    const mockCountData = {
      columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
      rows: [["100"]],
      totalRows: 1,
      truncated: false,
    };

    const mockTableData = {
      columns: [
        { name: "column1", type_name: "string", type_text: "string" },
        { name: "column2", type_name: "number", type_text: "number" },
      ],
      rows: [
        ["value1", "1"],
        ["value2", "2"],
      ],
      totalRows: 2,
      truncated: false,
    };

    // Create expected data format after transformation by the service
    const expectedTableData = {
      columns: mockTableData.columns,
      rows: [
        { column1: "value1", column2: "1" },
        { column1: "value2", column2: "2" },
      ],
      totalRows: mockTableData.totalRows,
      truncated: mockTableData.truncated,
    };

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for row count
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-count-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockCountData.columns.length,
            columns: mockCountData.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockCountData.totalRows,
          truncated: mockCountData.truncated,
        },
        result: {
          data_array: mockCountData.rows,
          chunk_index: 0,
          row_count: mockCountData.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for table data
    // pageSize is 20, page is 1 => LIMIT 20 OFFSET 0
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT * FROM test_table LIMIT 20 OFFSET 0",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockTableData.columns.length,
            columns: mockTableData.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockTableData.totalRows,
          truncated: mockTableData.truncated,
        },
        result: {
          data_array: mockTableData.rows,
          chunk_index: 0,
          row_count: mockTableData.rows.length,
          row_offset: 0,
        },
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "test_table",
      page: 1,
      pageSize: 20,
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify response structure - now an array with one element
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      name: "test_table",
      catalog_name: experiment.name,
      schema_name: `exp_${experiment.name}_${experiment.id}`,
      data: expectedTableData,
      page: 1,
      pageSize: 20,
      totalRows: 100,
      totalPages: 5, // 100 rows / 20 per page = 5 pages
    });
  });

  it("should return table list and sample data when no table name is specified", async () => {
    jest.setTimeout(30000); // Increase timeout for this test
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      embargoIntervalDays: 90,
      userId: testUserId,
    });

    // Mock the DatabricksService methods
    const mockTables = {
      tables: [
        {
          name: "table1",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_${experiment.name}_${experiment.id}`,
        },
        {
          name: "table2",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_${experiment.name}_${experiment.id}`,
        },
      ],
    };

    // Mock sample data for each table
    const mockSampleData1 = {
      columns: [
        { name: "column1", type_name: "string", type_text: "string" },
        { name: "column2", type_name: "number", type_text: "number" },
      ],
      rows: [
        ["value1", "1"],
        ["value2", "2"],
      ],
      totalRows: 2,
      truncated: false,
    };

    const mockSampleData2 = {
      columns: [
        { name: "column1", type_name: "string", type_text: "string" },
        { name: "column2", type_name: "number", type_text: "number" },
      ],
      rows: [
        ["value3", "3"],
        ["value4", "4"],
      ],
      totalRows: 2,
      truncated: false,
    };

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call
    nock(DATABRICKS_HOST).get(DatabricksService.TABLES_ENDPOINT).query(true).reply(200, mockTables);

    // Mock SQL query for sample data - first table ("table1")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM table1 LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-sample1-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockSampleData1.columns.length,
            columns: mockSampleData1.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockSampleData1.totalRows,
          truncated: mockSampleData1.truncated,
        },
        result: {
          data_array: mockSampleData1.rows,
          chunk_index: 0,
          row_count: mockSampleData1.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for sample data - second table ("table2")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM table2 LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-sample2-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockSampleData2.columns.length,
            columns: mockSampleData2.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockSampleData2.totalRows,
          truncated: mockSampleData2.truncated,
        },
        result: {
          data_array: mockSampleData2.rows,
          chunk_index: 0,
          row_count: mockSampleData2.rows.length,
          row_offset: 0,
        },
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      page: 1,
      pageSize: 5,
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify response structure with our new array-based format
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(2); // Should have 2 tables

    // Check first table
    expect(result.value[0]).toMatchObject({
      name: mockTables.tables[0].name,
      catalog_name: mockTables.tables[0].catalog_name,
      schema_name: mockTables.tables[0].schema_name,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    // Check second table
    expect(result.value[1]).toMatchObject({
      name: mockTables.tables[1].name,
      catalog_name: mockTables.tables[1].catalog_name,
      schema_name: mockTables.tables[1].schema_name,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    // Check data exists for each table
    expect(result.value[0].data).toBeDefined();
    expect(result.value[1].data).toBeDefined();
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId, testUserId, {
      page: 1,
      pageSize: 20,
    });

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

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      page: 1,
      pageSize: 20,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should allow access to public experiment even if user is not a member", async () => {
    // Create a public experiment with another user
    const otherUserId = await testApp.createTestUser({
      email: "other@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Public Experiment",
      description: "Public experiment",
      status: "active",
      visibility: "public",
      userId: otherUserId,
    });

    // Mock the DatabricksService methods
    const mockTables = {
      tables: [
        {
          name: "public_table",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_${experiment.name}_${experiment.id}`,
        },
      ],
    };

    // Mock sample data for the table
    const mockSampleData = {
      columns: [
        { name: "column1", type_name: "string", type_text: "string" },
        { name: "column2", type_name: "number", type_text: "number" },
      ],
      rows: [
        ["value1", "1"],
        ["value2", "2"],
      ],
      totalRows: 2,
      truncated: false,
    };

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call
    nock(DATABRICKS_HOST).get(DatabricksService.TABLES_ENDPOINT).query(true).reply(200, mockTables);

    // Mock SQL query for sample data ("public_table")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM public_table LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-statement-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockSampleData.columns.length,
            columns: mockSampleData.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockSampleData.totalRows,
          truncated: mockSampleData.truncated,
        },
        result: {
          data_array: mockSampleData.rows,
          chunk_index: 0,
          row_count: mockSampleData.rows.length,
          row_offset: 0,
        },
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      page: 1,
      pageSize: 5, // Using the default 5 now
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify the array response structure
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);

    // Verify the table data
    expect(result.value[0].name).toBe(mockTables.tables[0].name);
    expect(result.value[0].catalog_name).toBe(mockTables.tables[0].catalog_name);
    expect(result.value[0].schema_name).toBe(mockTables.tables[0].schema_name);
  });

  it("should handle Databricks service errors appropriately when getting table data", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    // Mock count query success but data query failure
    const mockCountData = {
      columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
      rows: [["100"]],
      totalRows: 1,
      truncated: false,
    };

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for row count - success
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-count-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockCountData.columns.length,
            columns: mockCountData.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockCountData.totalRows,
          truncated: mockCountData.truncated,
        },
        result: {
          data_array: mockCountData.rows,
          chunk_index: 0,
          row_count: mockCountData.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for table data - error
    // pageSize is 20, page is 1 => LIMIT 20 OFFSET 0
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT * FROM test_table LIMIT 20 OFFSET 0",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(500, { error: "Databricks error" }); // Error response does not need manifest/result

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "test_table",
      page: 1,
      pageSize: 20,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to get table data");
  });

  it("should handle Databricks service errors appropriately when getting row count", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for row count - error
    nock(DATABRICKS_HOST)
      .post(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${experiment.name}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(500, { error: "Count query error" }); // Error response does not need manifest/result

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "test_table",
      page: 1,
      pageSize: 20,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to get row count");
  });

  it("should handle Databricks service errors appropriately when listing tables", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call - error
    nock(DATABRICKS_HOST)
      .get(DatabricksService.TABLES_ENDPOINT)
      .query(true)
      .reply(500, { error: "Tables listing error" });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      page: 1,
      pageSize: 20,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to list tables");
  });
});
