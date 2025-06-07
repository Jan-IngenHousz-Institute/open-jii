import nock from "nock";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import {
  assertFailure,
  assertSuccess,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentDataUseCase } from "./get-experiment-data";

const DATABRICKS_HOST = "https://databricks.example.com";

describe("GetExperimentDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentDataUseCase;

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

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for row count
    nock(DATABRICKS_HOST)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(200, {
        statement_id: "mock-count-id",
        status: { state: "SUCCEEDED" },
        result: mockCountData,
      });

    // Mock SQL query for table data
    nock(DATABRICKS_HOST)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(200, {
        statement_id: "mock-data-id",
        status: { state: "SUCCEEDED" },
        result: mockTableData,
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

    // Verify response structure
    expect(result.value).toMatchObject({
      data: mockTableData,
      tableName: "test_table",
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
          catalog_name: "catalog1",
          schema_name: `exp_${experiment.name}_${experiment.id}`,
        },
        {
          name: "table2",
          catalog_name: "catalog1",
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
    nock(DATABRICKS_HOST)
      .post(DatabricksService.TABLES_ENDPOINT)
      .reply(200, mockTables);

    // Mock SQL query for sample data - first table
    nock(DATABRICKS_HOST)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(200, {
        statement_id: "mock-sample1-id",
        status: { state: "SUCCEEDED" },
        result: mockSampleData1,
      });

    // Mock SQL query for sample data - second table
    nock(DATABRICKS_HOST)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(200, {
        statement_id: "mock-sample2-id",
        status: { state: "SUCCEEDED" },
        result: mockSampleData2,
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      page: 1,
      pageSize: 5,
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify response structure
    // Check main structure properties
    expect(result.value.tables).toEqual(mockTables.tables);
    expect(result.value.page).toBe(1);
    expect(result.value.pageSize).toBe(5);
    expect(result.value.totalRows).toBe(2);
    expect(result.value.totalPages).toBe(1);

    // Check data structure
    expect(result.value.data?.totalRows).toBe(2);

    // Check columns
    const columns = result.value.data?.columns;
    expect(columns).toHaveLength(2);
    expect(columns?.[0]).toMatchObject({
      name: "table_name",
      type_name: "STRING",
      type_text: "STRING",
    });
    expect(columns?.[1]).toMatchObject({
      name: "sample_data",
      type_name: "STRING",
      type_text: "STRING",
    });

    // Check rows
    const rows = result.value.data?.rows;
    expect(rows).toHaveLength(2);
    expect(rows?.[0][0]).toBe("table1");
    expect(rows?.[1][0]).toBe("table2");
    expect(typeof rows?.[0][1]).toBe("string");
    expect(typeof rows?.[1][1]).toBe("string");
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
    expect(result.error.message).toContain(
      `Experiment with ID ${nonExistentId} not found`,
    );
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
    expect(result.error.message).toContain(
      "You do not have access to this experiment",
    );
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
          catalog_name: "catalog1",
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
    nock(DATABRICKS_HOST)
      .post(DatabricksService.TABLES_ENDPOINT)
      .reply(200, mockTables);

    // Mock SQL query for sample data
    nock(DATABRICKS_HOST)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(200, {
        statement_id: "mock-statement-id",
        status: { state: "SUCCEEDED" },
        result: mockSampleData,
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      page: 1,
      pageSize: 5, // Using the default 5 now
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify tables are returned
    expect(result.value).toHaveProperty("tables");
    expect(result.value.tables).toEqual(mockTables.tables);
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
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(200, {
        statement_id: "mock-count-id",
        status: { state: "SUCCEEDED" },
        result: mockCountData,
      });

    // Mock SQL query for table data - error
    nock(DATABRICKS_HOST)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(500, { error: "Databricks error" });

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
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .query(() => true)
      .reply(500, { error: "Count query error" });

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
      .post(DatabricksService.TABLES_ENDPOINT)
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
