import nock from "nock";

import { DatabricksAuthService } from "../../../../common/modules/databricks/services/auth/auth.service";
import { DatabricksSqlService } from "../../../../common/modules/databricks/services/sql/sql.service";
import { DatabricksTablesService } from "../../../../common/modules/databricks/services/tables/tables.service";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentDataUseCase } from "./get-experiment-data";

const DATABRICKS_HOST = "https://test-databricks.example.com";

describe("GetExperimentDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentDataUseCase;

  const MOCK_WAREHOUSE_ID = "test-warehouse-id";
  const MOCK_CATALOG_NAME = "test_catalog";
  const MOCK_WAIT_TIMEOUT = "50s";
  const MOCK_DISPOSITION = "INLINE";
  const MOCK_FORMAT = "JSON_ARRAY";
  const SAMPLE_DATA_LIMIT = 5;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentDataUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // Test for transforming schema data is covered indirectly in other tests
  // through the integration tests that verify the end-to-end behavior

  it("should return specific column data when columns are specified", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the Databricks methods for column-specific query
    const mockColumnData = {
      columns: [
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        ["2023-01-01T12:00:00Z", "25.5"],
        ["2023-01-01T12:01:00Z", "26.0"],
        ["2023-01-01T12:02:00Z", "25.8"],
      ],
      totalRows: 3,
      truncated: false,
    };

    // Create expected data format after transformation by the service
    const expectedColumnData = {
      columns: mockColumnData.columns,
      rows: [
        { timestamp: "2023-01-01T12:00:00Z", temperature: "25.5" },
        { timestamp: "2023-01-01T12:01:00Z", temperature: "26.0" },
        { timestamp: "2023-01-01T12:02:00Z", temperature: "25.8" },
      ],
      totalRows: mockColumnData.totalRows,
      truncated: mockColumnData.truncated,
    };

    // Generate clean schema name to match the implementation
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "sensor_data",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_${cleanName}_${experiment.id}`,
          },
        ],
      });

    // Mock SQL query for describing columns
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["timestamp", "TIMESTAMP", null],
        ["temperature", "DOUBLE", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE sensor_data",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for specific columns (no pagination - full data)
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT `timestamp`, `temperature` FROM sensor_data ORDER BY timestamp DESC",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-column-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockColumnData.columns.length,
            columns: mockColumnData.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockColumnData.totalRows,
          truncated: mockColumnData.truncated,
        },
        result: {
          data_array: mockColumnData.rows,
          chunk_index: 0,
          row_count: mockColumnData.rows.length,
          row_offset: 0,
        },
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "sensor_data",
      columns: "timestamp,temperature",
      page: 1,
      pageSize: 5,
    });

    // Assert result is success
    if (result.isFailure()) {
      console.log("Test failed with error:", result.error);
    }
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify response structure - should be array with one element (full-columns mode)
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      name: "sensor_data",
      catalog_name: experiment.name,
      schema_name: `exp_${cleanName}_${experiment.id}`,
      data: expectedColumnData,
      page: 1,
      pageSize: 3, // Should equal totalRows for full data
      totalRows: 3,
      totalPages: 1, // No pagination for column-specific queries
    });
  });

  it("should return table data when table name is specified", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the Databricks methods
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "test_table",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_test_experiment_${experiment.id}`,
          },
        ],
      });

    // Mock SQL query for describing columns
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["column1", "STRING", null],
        ["column2", "NUMBER", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for row count
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT * FROM test_table LIMIT 20 OFFSET 0",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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
      schema_name: `exp_test_experiment_${experiment.id}`,
      data: expectedTableData,
      page: 1,
      pageSize: 20,
      totalRows: 100,
      totalPages: 5, // 100 rows / 20 per page = 5 pages
    });
  });

  it("should return table data with ORDER BY when orderBy and orderDirection are specified", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the Databricks methods
    const mockCountData = {
      columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
      rows: [["100"]],
      totalRows: 1,
      truncated: false,
    };

    const mockTableData = {
      columns: [
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        ["2023-01-01T12:02:00Z", "25.8"],
        ["2023-01-01T12:01:00Z", "26.0"],
        ["2023-01-01T12:00:00Z", "25.5"],
      ],
      totalRows: 3,
      truncated: false,
    };

    // Expected data after transformation
    const expectedTableData = {
      columns: mockTableData.columns,
      rows: [
        { timestamp: "2023-01-01T12:02:00Z", temperature: "25.8" },
        { timestamp: "2023-01-01T12:01:00Z", temperature: "26.0" },
        { timestamp: "2023-01-01T12:00:00Z", temperature: "25.5" },
      ],
      totalRows: mockTableData.totalRows,
      truncated: mockTableData.truncated,
    };

    // Generate clean schema name to match the implementation
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "sensor_data",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_${cleanName}_${experiment.id}`,
          },
        ],
      });

    // Mock count query for pagination
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM sensor_data",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
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

    // Mock SQL query with ORDER BY clause
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT * FROM sensor_data ORDER BY `timestamp` DESC LIMIT 20 OFFSET 0",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
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
      tableName: "sensor_data",
      page: 1,
      pageSize: 20,
      orderBy: "timestamp",
      orderDirection: "DESC",
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify response structure
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      name: "sensor_data",
      catalog_name: experiment.name,
      schema_name: `exp_${cleanName}_${experiment.id}`,
      data: expectedTableData,
      page: 1,
      pageSize: 20,
      totalRows: 100,
      totalPages: 5, // 100 rows / 20 per page = 5 pages
    });
  });

  it("should return table list and sample data when no table name is specified", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the Databricks methods
    const mockTables = {
      tables: [
        {
          name: "table1",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_test_experiment_${experiment.id}`,
        },
        {
          name: "table2",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_test_experiment_${experiment.id}`,
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, mockTables);

    // Mock SQL query for describing columns
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["column1", "STRING", null],
        ["column2", "NUMBER", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE table1",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE table2",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for sample data - first table ("table1")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM table1 LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM table2 LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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

  it("should return table list when no table name is specified and place device table last", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the Databricks methods
    const mockTables = {
      tables: [
        {
          name: "device",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_test_experiment_${experiment.id}`,
        },
        {
          name: "sample",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_test_experiment_${experiment.id}`,
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, mockTables);

    // Mock SQL query for describing columns for both tables
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["column1", "STRING", null],
        ["column2", "NUMBER", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE device",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE sample",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for sample data - first table ("device")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM device LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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

    // Mock SQL query for sample data - second table ("sample")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM sample LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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

    // Check first table which should be "sample" (not "device")
    expect(result.value[0]).toMatchObject({
      name: mockTables.tables[1].name,
      catalog_name: mockTables.tables[1].catalog_name,
      schema_name: mockTables.tables[1].schema_name,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    // Check second table which should be "device"
    expect(result.value[1]).toMatchObject({
      name: mockTables.tables[0].name,
      catalog_name: mockTables.tables[0].catalog_name,
      schema_name: mockTables.tables[0].schema_name,
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

    // Mock the Databricks methods
    const mockTables = {
      tables: [
        {
          name: "public_table",
          catalog_name: MOCK_CATALOG_NAME, // Corrected from "catalog1"
          schema_name: `exp_public_experiment_${experiment.id}`,
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, mockTables);

    // Mock SQL query for describing columns
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["column1", "STRING", null],
        ["column2", "NUMBER", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE public_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_public_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for sample data ("public_table")
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: `SELECT * FROM public_table LIMIT ${SAMPLE_DATA_LIMIT}`, // Removed OFFSET 0
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_public_experiment_${experiment.id}`,
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "test_table",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_test_experiment_${experiment.id}`,
          },
        ],
      });

    // Mock SQL query for row count - success
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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

    // Mock SQL query for describing columns
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["column1", "STRING", null],
        ["column2", "NUMBER", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for table data - error
    // pageSize is 20, page is 1 => LIMIT 20 OFFSET 0
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT * FROM test_table LIMIT 20 OFFSET 0",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "test_table",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_test_experiment_${experiment.id}`,
          },
        ],
      });

    // Mock SQL query for row count - error
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT COUNT(*) as count FROM test_table",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_test_experiment_${experiment.id}`,
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call - error
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
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

  it("should return not found error when specified table does not exist", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the Databricks methods - empty tables list
    const mockTables = {
      tables: [
        {
          name: "existing_table",
          catalog_name: MOCK_CATALOG_NAME,
          schema_name: `exp_test_experiment_${experiment.id}`,
        },
      ],
    };

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, mockTables);

    // Act - try to access a table that doesn't exist
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "non_existent_table",
      page: 1,
      pageSize: 20,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(
      "Table 'non_existent_table' not found in this experiment",
    );
  });

  it("should handle SQL query failure in fetchSpecificColumns", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Generate clean schema name to match the implementation
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "sensor_data",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_${cleanName}_${experiment.id}`,
          },
        ],
      });

    // Mock SQL query for describing columns
    const mockMetadata = {
      columns: [
        { name: "col_name", type_name: "STRING", type_text: "STRING" },
        { name: "data_type", type_name: "STRING", type_text: "STRING" },
        { name: "comment", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [
        ["timestamp", "TIMESTAMP", null],
        ["temperature", "DOUBLE", null],
      ],
      totalRows: 2,
      truncated: false,
    };
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "DESCRIBE sensor_data",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: mockMetadata.columns.length,
            columns: mockMetadata.columns.map((col, i) => ({
              ...col,
              position: i,
            })),
          },
          total_row_count: mockMetadata.totalRows,
          truncated: mockMetadata.truncated,
        },
        result: {
          data_array: mockMetadata.rows,
          chunk_index: 0,
          row_count: mockMetadata.rows.length,
          row_offset: 0,
        },
      });

    // Mock SQL query for specific columns - failure
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT `timestamp`, `temperature` FROM sensor_data ORDER BY timestamp DESC",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(500, { error: "SQL execution failed" });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "sensor_data",
      columns: "timestamp, temperature",
      page: 1,
      pageSize: 5,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toContain("Failed to get table data");
  });

  it("should handle listTables failure in validateTableExists", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call - failure
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(500, { error: "Failed to list tables" });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "sensor_data",
      columns: "timestamp, temperature",
      page: 1,
      pageSize: 5,
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toContain("Failed to list tables");
  });
});
