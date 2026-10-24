import nock from "nock";

import type { DataExportJobInput } from "../../../experiments/core/ports/databricks.port";
import { TestHarness } from "../../../test/test-harness";
import { AppError, assertFailure, assertSuccess, failure, success } from "../../utils/fp-utils";
import type { Result } from "../../utils/fp-utils";
import { DatabricksAdapter } from "./databricks.adapter";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import { DatabricksSqlService } from "./services/sql/sql.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksAdapter", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    databricksAdapter = testApp.module.get(DatabricksAdapter);

    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("healthCheck", () => {
    it("should return successful health check when Databricks API is available", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock jobs list API call
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/list`)
        .query(true)
        .reply(200, {
          jobs: [{ job_id: 12345, settings: { name: "Test Job" } }],
        });

      // Execute health check
      const result = await databricksAdapter.healthCheck();

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        healthy: true,
        service: "databricks",
      });
    });
  });

  describe("triggerDataUploadJob", () => {
    it("should successfully trigger data upload job", async () => {
      const mockParams = {
        sourceKind: "ambyte" as const,
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        uploadDirectory: "upload_2026-01-01",
        uploadId: "upload-1",
        uploadTableId: "11111111-1111-1111-1111-111111111111",
        uploadTableName: "ambyte_legacy",
        userId: "user-1",
      };

      const mockResponse = {
        run_id: 54321,
        number_in_job: 1,
      };

      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue("main");

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request - expect CATALOG_NAME to be added to params
      const expectedYearPrefix = new Date().getUTCFullYear().toString();
      nock(databricksHost)
        .post(
          `${DatabricksJobsService.JOBS_ENDPOINT}/run-now`,
          (body: { job_parameters?: Record<string, string> }) => {
            return (
              body.job_parameters?.CATALOG_NAME === "main" &&
              body.job_parameters.EXPERIMENT_ID === "exp-123" &&
              body.job_parameters.SOURCE_KIND === "ambyte" &&
              body.job_parameters.YEAR_PREFIX === expectedYearPrefix
            );
          },
        )
        .reply(200, mockResponse);

      const result = await databricksAdapter.triggerDataUploadJob(mockParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });
  });

  describe("executeSqlQuery", () => {
    const schemaName = "exp_test_experiment_123";
    const sqlStatement = "SELECT * FROM test_table";

    it("should successfully execute a SQL query and return results", async () => {
      const mockTableData = {
        columns: [
          { name: "column1", type_name: "string", type_text: "string", position: 0 },
          { name: "column2", type_name: "number", type_text: "number", position: 1 },
        ],
        rows: [
          ["value1", "1"],
          ["value2", "2"],
        ],
        totalRows: 2,
        truncated: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "mock-statement-id",
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

      // Execute SQL query
      const result = await databricksAdapter.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockTableData);
    });
  });

  describe("getExperimentTableMetadata", () => {
    const experimentId = "exp-123";

    it("should successfully retrieve table metadata with schemas", async () => {
      const mockMetadata = {
        columns: [
          { name: "identifier", type_name: "string", type_text: "string" },
          { name: "table_type", type_name: "string", type_text: "string" },
          { name: "display_name", type_name: "string", type_text: "string" },
          { name: "row_count", type_name: "bigint", type_text: "bigint" },
          { name: "latest_row_at", type_name: "timestamp", type_text: "timestamp" },
          { name: "schema_revision", type_name: "string", type_text: "string" },
          { name: "macro_schema", type_name: "string", type_text: "string" },
          { name: "questions_schema", type_name: "string", type_text: "string" },
          { name: "custom_metadata_schema", type_name: "string", type_text: "string" },
          { name: "upload_schema", type_name: "string", type_text: "string" },
        ],
        rows: [
          [
            "raw_data",
            "static",
            null,
            "100",
            "2026-09-22T10:05:00.000Z",
            "rev-raw",
            null,
            null,
            null,
            null,
          ],
          ["device", "static", null, "50", null, "rev-device", null, null, null, null],
          [
            "some_macro_id",
            "macro",
            null,
            "25",
            "2026-09-22T10:05:30Z",
            "rev-macro",
            '{"col1":"int"}',
            '{"q1":"text"}',
            '{"plot":"string"}',
            null,
          ],
        ],
        totalRows: 3,
        truncated: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "mock-statement-id",
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
          },
        });

      // Execute getExperimentTableMetadata
      const result = await databricksAdapter.getExperimentTableMetadata(experimentId);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: "2026-09-22T10:05:00.000Z",
          schemaRevision: "rev-raw",
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
          uploadSchema: null,
        },
        {
          identifier: "device",
          tableType: "static",
          displayName: null,
          rowCount: 50,
          latestRowAt: null,
          schemaRevision: "rev-device",
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
          uploadSchema: null,
        },
        {
          identifier: "some_macro_id",
          tableType: "macro",
          displayName: null,
          rowCount: 25,
          latestRowAt: "2026-09-22T10:05:30.000Z",
          schemaRevision: "rev-macro",
          macroSchema: '{"col1":"int"}',
          questionsSchema: '{"q1":"text"}',
          customMetadataSchema: '{"plot":"string"}',
          uploadSchema: null,
        },
      ]);
    });

    it("should retrieve metadata for specific table only", async () => {
      const mockMetadata = {
        columns: [
          { name: "identifier", type_name: "string", type_text: "string" },
          { name: "table_type", type_name: "string", type_text: "string" },
          { name: "display_name", type_name: "string", type_text: "string" },
          { name: "row_count", type_name: "bigint", type_text: "bigint" },
          { name: "latest_row_at", type_name: "timestamp", type_text: "timestamp" },
          { name: "schema_revision", type_name: "string", type_text: "string" },
          { name: "macro_schema", type_name: "string", type_text: "string" },
          { name: "questions_schema", type_name: "string", type_text: "string" },
          { name: "custom_metadata_schema", type_name: "string", type_text: "string" },
          { name: "upload_schema", type_name: "string", type_text: "string" },
        ],
        rows: [["device", "static", null, "50", null, "rev-device", null, null, null, null]],
        totalRows: 1,
        truncated: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "mock-statement-id",
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
          },
        });

      // Execute getExperimentTableMetadata with specific table
      const result = await databricksAdapter.getExperimentTableMetadata(experimentId, {
        identifier: "device",
      });

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([
        {
          identifier: "device",
          tableType: "static",
          displayName: null,
          rowCount: 50,
          latestRowAt: null,
          schemaRevision: "rev-device",
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
          uploadSchema: null,
        },
      ]);
    });

    it("should exclude schemas when includeSchemas is false", async () => {
      const mockMetadata = {
        columns: [
          { name: "identifier", type_name: "string", type_text: "string" },
          { name: "table_type", type_name: "string", type_text: "string" },
          { name: "display_name", type_name: "string", type_text: "string" },
          { name: "row_count", type_name: "bigint", type_text: "bigint" },
          { name: "latest_row_at", type_name: "timestamp", type_text: "timestamp" },
          { name: "schema_revision", type_name: "string", type_text: "string" },
        ],
        rows: [
          ["raw_data", "static", null, "100", "2026-09-22T10:05:00Z", "rev-raw"],
          ["device", "static", null, "50", null, null],
        ],
        totalRows: 2,
        truncated: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "mock-statement-id",
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
          },
        });

      // Execute getExperimentTableMetadata without schemas
      const result = await databricksAdapter.getExperimentTableMetadata(experimentId, {
        includeSchemas: false,
      });

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: "2026-09-22T10:05:00.000Z",
          schemaRevision: "rev-raw",
        },
        {
          identifier: "device",
          tableType: "static",
          displayName: null,
          rowCount: 50,
          latestRowAt: null,
          schemaRevision: null,
        },
      ]);
    });

    it("should handle SQL query failure", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL query with failure
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(500, { message: "SQL execution failed" });

      const result = await databricksAdapter.getExperimentTableMetadata(experimentId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });

    it("should handle invalid query result format without rows", async () => {
      const sqlService = testApp.module.get(DatabricksSqlService);
      const spy = vi
        .spyOn(sqlService, "executeSqlQuery")
        .mockResolvedValue(success({ columns: [], totalRows: 0, truncated: false } as never));

      const result = await databricksAdapter.getExperimentTableMetadata(experimentId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid query result format");

      spy.mockRestore();
    });
  });

  describe("getExperimentTableColumns", () => {
    it("describes the table's view and keeps only the column section", async () => {
      const sqlService = testApp.module.get(DatabricksSqlService);
      const spy = vi.spyOn(sqlService, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [],
          rows: [
            ["id", "bigint", null],
            ["device", "struct<serial: string>", null],
            ["", "", ""],
            ["# Clustering Information", "", ""],
            ["experiment_id", "string", null],
          ],
          totalRows: 5,
          truncated: false,
        }),
      );

      const result = await databricksAdapter.getExperimentTableColumns("macro", "some_macro_id");

      assertSuccess(result);
      expect(result.value).toEqual(["id", "device"]);
      const [schemaName, statement] = spy.mock.calls[0];
      expect(schemaName).toBe(databricksAdapter.CENTRUM_SCHEMA_NAME);
      expect(statement).toMatch(/^DESCRIBE TABLE /);
      expect(statement).toContain(databricksAdapter.MACRO_DATA_TABLE_NAME);

      spy.mockRestore();
    });

    it("fails for a static table it has no view for", async () => {
      const result = await databricksAdapter.getExperimentTableColumns("static", "unknown");

      assertFailure(result);
      expect(result.error.code).toBe("UNKNOWN_TABLE_MAPPING");
    });

    it("passes on a failed DESCRIBE", async () => {
      const sqlService = testApp.module.get(DatabricksSqlService);
      const spy = vi
        .spyOn(sqlService, "executeSqlQuery")
        .mockResolvedValue(failure(AppError.internal("warehouse unavailable")));

      const result = await databricksAdapter.getExperimentTableColumns("upload", "upload_1");

      assertFailure(result);
      expect(result.error.message).toBe("warehouse unavailable");
      expect(spy.mock.calls[0][1]).toContain(databricksAdapter.UPLOADED_DATA_TABLE_NAME);

      spy.mockRestore();
    });
  });

  describe("buildExperimentQuery", () => {
    it("builds an upload table's query on the uploads table, filtered by its upload table id", () => {
      const result = databricksAdapter.buildExperimentQuery({
        tableName: "upload_1",
        tableType: "upload",
        experimentId: "exp-123",
        columns: ["id"],
      });

      assertSuccess(result);
      expect(result.value).toContain(databricksAdapter.UPLOADED_DATA_TABLE_NAME);
      expect(result.value).toContain("`experiment_id` = 'exp-123'");
      expect(result.value).toContain("`upload_table_id` = 'upload_1'");
    });

    it("fails for a static table it has no table for", () => {
      const result = databricksAdapter.buildExperimentQuery({
        tableName: "unknown",
        tableType: "static",
        experimentId: "exp-123",
      });

      assertFailure(result);
      expect(result.error.code).toBe("UNKNOWN_TABLE_MAPPING");
    });

    it("should build query for standard tables (raw_data, device)", () => {
      const result = databricksAdapter.buildExperimentQuery({
        tableName: "raw_data",
        tableType: "static",
        experimentId: "exp-123",
        columns: ["id", "timestamp"],
      });

      assertSuccess(result);
      const query = result.value;
      expect(query).toContain("SELECT `id`, `timestamp`");
      expect(query).toContain("WHERE `experiment_id` = 'exp-123'");
      expect(query).toContain(databricksAdapter.RAW_DATA_TABLE_NAME);
    });

    it("should build query for macro tables with macro_id filter", () => {
      const result = databricksAdapter.buildExperimentQuery({
        tableName: "some_macro_id",
        tableType: "macro",
        experimentId: "exp-123",
        columns: ["id", "data"],
      });

      assertSuccess(result);
      const query = result.value;
      expect(query).toContain("SELECT `id`, `data`");
      expect(query).toContain("WHERE `experiment_id` = 'exp-123'");
      expect(query).toContain("`macro_id` = 'some_macro_id'");
      expect(query).toContain(databricksAdapter.MACRO_DATA_TABLE_NAME);
    });

    it("should handle VARIANT columns parsing", () => {
      const result = databricksAdapter.buildExperimentQuery({
        tableName: "device",
        tableType: "static",
        experimentId: "exp-123",
        variants: [{ columnName: "data", schema: "OBJECT<field1: INT>" }],
      });

      assertSuccess(result);
      const query = result.value;
      expect(query).toContain(
        "SELECT * EXCEPT (`data`), try_variant_get(`data`, '$[\"field1\"]', 'INT') AS `field1`",
      );
    });

    it("should handle all query options (limit, offset, orderBy)", () => {
      const result = databricksAdapter.buildExperimentQuery({
        tableName: "raw_data",
        tableType: "static",
        experimentId: "exp-123",
        columns: ["id", "timestamp"],
        orderBy: "timestamp",
        orderDirection: "DESC",
        limit: 100,
        offset: 50,
      });

      assertSuccess(result);
      const query = result.value;
      expect(query).toContain("ORDER BY `timestamp` DESC");
      expect(query).toContain("LIMIT 100");
      expect(query).toContain("OFFSET 50");
    });
  });

  describe("uploadExperimentData", () => {
    const schemaName = "exp_test_experiment_123";
    const experimentId = "123-456-789";
    const sourceType = "ambyte";
    const directoryName = "upload_20250910_143022_123-456-789";
    const fileName = "data.csv";
    const fileBuffer = Buffer.from("test,data");
    const catalogName = "main";

    it("should correctly format the file path and upload the file", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected file path
      const expectedFilePath = `/Volumes/${catalogName}/${schemaName}/data-imports/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload API call
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedFilePath}`)
        .query({ overwrite: "false" })
        .reply(200);

      // Execute upload file
      const result = await databricksAdapter.uploadExperimentData(
        schemaName,
        experimentId,
        sourceType,
        directoryName,
        fileName,
        fileBuffer,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        filePath: expectedFilePath,
      });
    });

    it("should handle spaces and special characters in experiment name", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Use consistent schema name
      const testSchemaName = "exp_test_experiment_with_spaces_123";
      const expectedFilePath = `/Volumes/${catalogName}/${testSchemaName}/data-imports/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload API call
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedFilePath}`)
        .query({ overwrite: "false" })
        .reply(200);

      // Execute upload file
      const result = await databricksAdapter.uploadExperimentData(
        testSchemaName,
        experimentId,
        sourceType,
        directoryName,
        fileName,
        fileBuffer,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.filePath).toEqual(expectedFilePath);
    });
  });

  describe("triggerDataExportJob", () => {
    const exportInput = {
      exportId: "8c1f6a0e-4c35-4d7e-9a43-3f0b2a5d1e77",
      experimentId: "exp-456",
      tableName: "raw_data",
      format: "csv",
      userId: "user-123",
      anonymizeContributors: false,
    } satisfies DataExportJobInput;

    it("passes the export id to the run and uses it as the idempotency token", async () => {
      const mockResponse = {
        run_id: 99999,
        number_in_job: 1,
      };

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue("main");

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .post(
          `${DatabricksJobsService.JOBS_ENDPOINT}/run-now`,
          (body: { idempotency_token?: string; job_parameters?: Record<string, string> }) => {
            const params = body.job_parameters;
            if (!params) return false;
            return (
              body.idempotency_token === exportInput.exportId &&
              params.EXPORT_ID === exportInput.exportId &&
              params.EXPERIMENT_ID === exportInput.experimentId &&
              params.TABLE_NAME === exportInput.tableName &&
              params.FORMAT === exportInput.format &&
              params.USER_ID === exportInput.userId &&
              params.CATALOG_NAME === "main" &&
              params.ANONYMIZE_CONTRIBUTORS === "false"
            );
          },
        )
        .reply(200, mockResponse);

      const result = await databricksAdapter.triggerDataExportJob(exportInput);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API failure when triggering data export job", async () => {
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue("main");

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .post(`${DatabricksJobsService.JOBS_ENDPOINT}/run-now`)
        .reply(500, { message: "Internal server error" });

      const result = await databricksAdapter.triggerDataExportJob(exportInput);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks job trigger");
    });
  });

  describe("getDeviceLastActivity", () => {
    const mockSqlResponse = (dataArray: (string | null)[][], rowCount: number) => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "stmt-activity",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 3,
              columns: [
                { name: "client_id", type_name: "string", type_text: "string", position: 0 },
                {
                  name: "last_data_at",
                  type_name: "timestamp",
                  type_text: "timestamp",
                  position: 1,
                },
                { name: "measurement_count", type_name: "long", type_text: "bigint", position: 2 },
              ],
            },
            total_row_count: rowCount,
            truncated: false,
          },
          result: {
            data_array: dataArray,
            chunk_index: 0,
            row_count: rowCount,
            row_offset: 0,
          },
        });
    };

    it("returns the last data arrival as an ISO timestamp", async () => {
      mockSqlResponse([["AMBYTE_A", "2026-08-13T09:00:00.000Z", "42"]], 1);

      const result = await databricksAdapter.getDeviceLastActivity("AMBYTE_A");

      assertSuccess(result);
      expect(result.value).toEqual({ lastDataAt: "2026-08-13T09:00:00.000Z" });
    });

    it("returns null when the device has no activity row", async () => {
      mockSqlResponse([], 0);

      const result = await databricksAdapter.getDeviceLastActivity("AMBYTE_NEW");

      assertSuccess(result);
      expect(result.value).toEqual({ lastDataAt: null });
    });

    it("returns null for a row without a parsable last_data_at", async () => {
      mockSqlResponse([["AMBYTE_A", null, "0"]], 1);

      const result = await databricksAdapter.getDeviceLastActivity("AMBYTE_A");

      assertSuccess(result);
      expect(result.value).toEqual({ lastDataAt: null });
    });

    it("propagates a SQL failure", async () => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(500, { message: "warehouse unavailable" });

      const result = await databricksAdapter.getDeviceLastActivity("AMBYTE_A");

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("monitoring readers", () => {
    const mockSql = (columns: string[], dataArray: (string | null)[][]) => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "stmt-monitoring",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: columns.length,
              columns: columns.map((name, position) => ({
                name,
                type_name: "string",
                type_text: "string",
                position,
              })),
            },
            total_row_count: dataArray.length,
            truncated: false,
          },
          result: {
            data_array: dataArray,
            chunk_index: 0,
            row_count: dataArray.length,
            row_offset: 0,
          },
        });
    };

    it("maps lifecycle-event rows, normalizing timestamps and nulls", async () => {
      mockSql(
        ["event_type", "event_timestamp", "disconnect_reason", "session_identifier"],
        [
          ["connected", "2026-08-13T01:00:00.000Z", null, "s-1"],
          ["disconnected", "2026-08-13T03:00:00.000Z", "CONNECTION_LOST", null],
        ],
      );

      const result = await databricksAdapter.getDeviceLifecycleEvents(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T12:00:00.000Z",
        100,
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        {
          eventType: "connected",
          eventTimestamp: "2026-08-13T01:00:00.000Z",
          disconnectReason: null,
          sessionIdentifier: "s-1",
        },
        {
          eventType: "disconnected",
          eventTimestamp: "2026-08-13T03:00:00.000Z",
          disconnectReason: "CONNECTION_LOST",
          sessionIdentifier: null,
        },
      ]);
    });

    it("maps throughput buckets with their experiment attribution", async () => {
      mockSql(
        ["timestamp_hour", "experiment_id", "measurement_count"],
        [
          ["2026-08-13T01:00:00.000Z", "exp-1", "12"],
          ["2026-08-13T02:00:00.000Z", null, "3"],
        ],
      );

      const result = await databricksAdapter.getDeviceThroughput(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T12:00:00.000Z",
        "hour",
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: "exp-1", count: 12 },
        { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: null, count: 3 },
      ]);
    });

    it("maps the battery series, keeping null averages for battery-less buckets", async () => {
      mockSql(
        ["timestamp_day", "average_battery"],
        [
          ["2026-08-13T00:00:00.000Z", "87.5"],
          ["2026-08-14T00:00:00.000Z", null],
        ],
      );

      const result = await databricksAdapter.getDeviceBatterySeries(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-15T00:00:00.000Z",
        "day",
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        { bucketStart: "2026-08-13T00:00:00.000Z", averageBattery: 87.5 },
        { bucketStart: "2026-08-14T00:00:00.000Z", averageBattery: null },
      ]);
    });

    it("maps the macro breakdown", async () => {
      mockSql(
        ["macro_id", "row_count"],
        [
          ["macro-1", "20"],
          [null, "3"],
        ],
      );

      const result = await databricksAdapter.getDeviceMacroBreakdown(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T12:00:00.000Z",
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        { macroId: "macro-1", count: 20 },
        { macroId: null, count: 3 },
      ]);
    });

    it("maps the per-bucket firmware groups with their first and last sighting", async () => {
      mockSql(
        ["timestamp_hour", "device_version", "first_seen", "last_seen", "row_count"],
        [
          [
            "2026-08-13T01:00:00.000Z",
            "1.0.0",
            "2026-08-13T01:00:00.000Z",
            "2026-08-13T01:55:00.000Z",
            "60",
          ],
          [
            "2026-08-13T02:00:00.000Z",
            "1.1.0",
            "2026-08-13T02:05:00.000Z",
            "2026-08-13T02:50:00.000Z",
            "40",
          ],
        ],
      );

      const result = await databricksAdapter.getDeviceFirmwareHistory(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T12:00:00.000Z",
        "hour",
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        {
          version: "1.0.0",
          firstSeen: "2026-08-13T01:00:00.000Z",
          lastSeen: "2026-08-13T01:55:00.000Z",
          count: 60,
        },
        {
          version: "1.1.0",
          firstSeen: "2026-08-13T02:05:00.000Z",
          lastSeen: "2026-08-13T02:50:00.000Z",
          count: 40,
        },
      ]);
    });

    it("maps the payload breakdown, coercing missing counts to zero", async () => {
      mockSql(
        [
          "device_version",
          "protocol_id",
          "workbook_version_id",
          "workbook_run_id",
          "row_count",
          "gps_count",
          "battery_count",
        ],
        [
          ["1.1.0", null, "wb-1", "run-1", "20", "5", null],
          [null, "proto-1", null, null, "12", null, "12"],
        ],
      );

      const result = await databricksAdapter.getDevicePayloadBreakdown(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T12:00:00.000Z",
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        {
          deviceVersion: "1.1.0",
          protocolId: null,
          workbookVersionId: "wb-1",
          workbookRunId: "run-1",
          count: 20,
          withGps: 5,
          withBattery: 0,
        },
        {
          deviceVersion: null,
          protocolId: "proto-1",
          workbookVersionId: null,
          workbookRunId: null,
          count: 12,
          withGps: 0,
          withBattery: 12,
        },
      ]);
    });

    it("normalizes warehouse timestamps to ISO instants", async () => {
      mockSql(
        ["timestamp_hour", "experiment_id", "measurement_count"],
        [["2026-08-15T09:00:00.000Z", "exp-1", "4"]],
      );

      const result = await databricksAdapter.getDeviceThroughput(
        "AMBYTE_A",
        "2026-08-15T00:00:00.000Z",
        "2026-08-15T12:00:00.000Z",
        "hour",
      );

      assertSuccess(result);
      expect(result.value[0].bucketStart).toBe("2026-08-15T09:00:00.000Z");
    });

    it("maps recent measurements, coercing unparsable numerics to null", async () => {
      mockSql(
        [
          "timestamp",
          "experiment_id",
          "protocol_id",
          "workbook_version_id",
          "device_version",
          "device_battery",
          "latitude",
          "longitude",
          "sample",
        ],
        [
          [
            "2026-08-15T09:00:00.000Z",
            "exp-1",
            "proto-1",
            "wb-1",
            "1.1.0",
            "4.16",
            "51.98",
            "5.66",
            '[{"phi2":0.61}]',
          ],
          ["2026-08-15T08:00:00.000Z", null, null, null, null, null, null, null, null],
        ],
      );

      const result = await databricksAdapter.getDeviceRecentMeasurements(
        "AMBYTE_A",
        "2026-08-15T00:00:00.000Z",
        "2026-08-15T12:00:00.000Z",
        50,
      );

      assertSuccess(result);
      expect(result.value[0]).toEqual({
        timestamp: "2026-08-15T09:00:00.000Z",
        experimentId: "exp-1",
        protocolId: "proto-1",
        workbookVersionId: "wb-1",
        deviceVersion: "1.1.0",
        battery: 4.16,
        latitude: 51.98,
        longitude: 5.66,
        sample: '[{"phi2":0.61}]',
      });
      expect(result.value[1].battery).toBeNull();
      expect(result.value[1].latitude).toBeNull();
    });

    it("propagates a SQL failure from any reader", async () => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(500, { message: "warehouse unavailable" });

      const result = await databricksAdapter.getDeviceThroughput(
        "AMBYTE_A",
        "2026-08-13T00:00:00.000Z",
        "2026-08-13T12:00:00.000Z",
        "hour",
      );

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("getUploadMetadata", () => {
    it("queries experiment_upload_metadata with filters and returns schema data", async () => {
      const experimentId = "exp-up-1";
      const uploadTableName = "leaf_traits";

      const sqlService = testApp.module.get(DatabricksSqlService);
      const querySpy = vi.spyOn(sqlService, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [{ name: "upload_id", type_name: "string", type_text: "STRING", position: 0 }],
          rows: [["u1"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await databricksAdapter.getUploadMetadata(experimentId, { uploadTableName });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.rows).toHaveLength(1);

      expect(querySpy).toHaveBeenCalledOnce();
      const [, sql] = querySpy.mock.calls[0];
      expect(sql).toContain("experiment_upload_metadata");
      expect(sql).toContain(`'${experimentId}'`);
      expect(sql).toContain(`'${uploadTableName}'`);
    });

    it("omits upload_table_name filter when not provided", async () => {
      const sqlService = testApp.module.get(DatabricksSqlService);
      const querySpy = vi
        .spyOn(sqlService, "executeSqlQuery")
        .mockResolvedValue(success({ columns: [], rows: [], totalRows: 0, truncated: false }));

      await databricksAdapter.getUploadMetadata("exp-up-2");

      const [, sql] = querySpy.mock.calls[0];
      expect(sql).toContain("experiment_upload_metadata");
      expect(sql).not.toMatch(/where[\s\S]*upload_table_name\s*=/i);
    });
  });

  describe("getActiveUploads", () => {
    it("filters runs by experiment id and maps lifecycle states to upload statuses", async () => {
      const experimentId = "exp-up-3";
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 1,
              job_id: 77,
              state: { life_cycle_state: "RUNNING" },
              start_time: 1700_000_000_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_ID", value: "u-running" },
                { name: "SOURCE_KIND", value: "csv" },
                { name: "UPLOAD_TABLE_NAME", value: "leaf_traits" },
                { name: "USER_ID", value: "user-1" },
              ],
            },
            {
              run_id: 2,
              job_id: 77,
              state: { life_cycle_state: "PENDING" },
              start_time: 1700_000_001_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_ID", value: "u-pending" },
                { name: "SOURCE_KIND", value: "tsv" },
                { name: "USER_ID", value: "user-1" },
              ],
            },
            {
              run_id: 3,
              job_id: 77,
              state: { life_cycle_state: "RUNNING" },
              start_time: 1700_000_002_000,
              job_parameters: [{ name: "EXPERIMENT_ID", value: "other-exp" }],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveUploads(experimentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2);
      const byId = new Map(result.value.map((u) => [u.uploadId, u]));
      expect(byId.get("u-running")?.status).toBe("running");
      expect(byId.get("u-running")?.sourceKind).toBe("csv");
      expect(byId.get("u-pending")?.status).toBe("pending");
      expect(byId.get("u-pending")?.sourceKind).toBe("tsv");
    });

    it("further filters by upload table name when provided", async () => {
      const experimentId = "exp-up-4";
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 1,
              job_id: 77,
              state: { life_cycle_state: "RUNNING" },
              start_time: 1700_000_000_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_TABLE_NAME", value: "leaf_traits" },
                { name: "UPLOAD_ID", value: "u-1" },
                { name: "USER_ID", value: "user-1" },
                { name: "SOURCE_KIND", value: "csv" },
              ],
            },
            {
              run_id: 2,
              job_id: 77,
              state: { life_cycle_state: "RUNNING" },
              start_time: 1700_000_001_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_TABLE_NAME", value: "other" },
                { name: "UPLOAD_ID", value: "u-2" },
                { name: "USER_ID", value: "user-1" },
                { name: "SOURCE_KIND", value: "csv" },
              ],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveUploads(experimentId, {
        uploadTableName: "leaf_traits",
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].uploadId).toBe("u-1");
    });

    it("propagates job-runs API failures", async () => {
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(500, { message: "boom" });

      const result = await databricksAdapter.getActiveUploads("exp-up-5");

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });
  });

  describe("getActiveUploads filter branches", () => {
    it("skips runs that are missing UPLOAD_ID or USER_ID widgets (not our runs)", async () => {
      const experimentId = "exp-up-internal-err";
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 999,
              job_id: 77,
              state: { life_cycle_state: "INTERNAL_ERROR" },
              start_time: 1700_000_100_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "SOURCE_KIND", value: "csv" },
                // UPLOAD_ID + USER_ID deliberately omitted: run wasn't triggered by us.
              ],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveUploads(experimentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("skips runs whose SOURCE_KIND widget isn't a known kind", async () => {
      const experimentId = "exp-up-bad-kind";
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 1000,
              job_id: 77,
              state: { life_cycle_state: "RUNNING" },
              start_time: 1700_000_150_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_ID", value: "u-bad" },
                { name: "USER_ID", value: "user-1" },
                { name: "SOURCE_KIND", value: "orc" },
              ],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveUploads(experimentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("skips runs whose lifecycle state isn't queued/pending/running/terminating/internal_error", async () => {
      const experimentId = "exp-up-skip";
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 1,
              job_id: 77,
              state: { life_cycle_state: "TERMINATED", result_state: "SUCCESS" },
              start_time: 1700_000_200_000,
              job_parameters: [{ name: "EXPERIMENT_ID", value: experimentId }],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveUploads(experimentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });

  describe("getFailedUploads", () => {
    it("returns only terminated non-SUCCESS runs and dedupes against completedUploadIds", async () => {
      const experimentId = "exp-up-6";
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataUploadJobIdAsNumber").mockReturnValue(77);

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 10,
              job_id: 77,
              state: { life_cycle_state: "TERMINATED", result_state: "FAILED" },
              start_time: 1700_000_010_000,
              end_time: 1700_000_011_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_ID", value: "u-fail" },
                { name: "USER_ID", value: "user-1" },
                { name: "SOURCE_KIND", value: "csv" },
              ],
            },
            {
              run_id: 11,
              job_id: 77,
              state: { life_cycle_state: "TERMINATED", result_state: "SUCCESS" },
              start_time: 1700_000_012_000,
              end_time: 1700_000_013_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_ID", value: "u-ok" },
                { name: "USER_ID", value: "user-1" },
                { name: "SOURCE_KIND", value: "csv" },
              ],
            },
            {
              run_id: 12,
              job_id: 77,
              state: { life_cycle_state: "TERMINATED", result_state: "FAILED" },
              start_time: 1700_000_014_000,
              end_time: 1700_000_015_000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "UPLOAD_ID", value: "u-already-in-delta" },
                { name: "USER_ID", value: "user-1" },
                { name: "SOURCE_KIND", value: "csv" },
              ],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getFailedUploads(
        experimentId,
        new Set(["u-already-in-delta"]),
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].uploadId).toBe("u-fail");
      expect(result.value[0].status).toBe("failed");
    });
  });

  describe("grouped device scans", () => {
    interface CapturedStatement {
      statement?: string;
    }

    const mockGroupSql = (
      columns: string[],
      dataArray: (string | null)[][],
      captured: CapturedStatement,
    ) => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, (body: CapturedStatement) => {
          captured.statement = body.statement;
          return true;
        })
        .reply(200, {
          statement_id: "stmt-group",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: columns.length,
              columns: columns.map((name, position) => ({
                name,
                type_name: "string",
                type_text: "string",
                position,
              })),
            },
            total_row_count: dataArray.length,
            truncated: false,
          },
          result: {
            data_array: dataArray,
            chunk_index: 0,
            row_count: dataArray.length,
            row_offset: 0,
          },
        });
    };

    const THINGS = ["AMBYTE_A", "AMBYTE_B"];
    const FROM = "2026-08-17T00:00:00.000Z";
    const TO = "2026-08-18T00:00:00.000Z";

    it("maps batched last activity by thing name", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["client_id", "last_data_at"],
        [
          ["AMBYTE_A", "2026-08-17T10:00:00.000Z"],
          ["AMBYTE_B", null],
        ],
        captured,
      );

      const result = await databricksAdapter.getDevicesLastActivity(THINGS);

      assertSuccess(result);
      expect(result.value.get("AMBYTE_A")).toBe("2026-08-17T10:00:00.000Z");
      expect(result.value.get("AMBYTE_B")).toBeNull();
      // One grouped scan over the member set, never a query per device.
      expect(captured.statement).toContain("IN ('AMBYTE_A', 'AMBYTE_B')");
    });

    it("maps grouped throughput rows and applies the row ceiling", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["timestamp_hour", "client_id", "measurement_count"],
        [["2026-08-17T10:00:00.000Z", "AMBYTE_A", "4"]],
        captured,
      );

      const result = await databricksAdapter.getDevicesThroughput(THINGS, FROM, TO, "hour", 50);

      assertSuccess(result);
      expect(result.value).toEqual([
        { bucketStart: "2026-08-17T10:00:00.000Z", clientId: "AMBYTE_A", count: 4 },
      ]);
      expect(captured.statement).toContain("LIMIT 50");
    });

    it("maps one experiment's publishers, newest arrival first", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["client_id", "measurement_count", "last_data_at"],
        [
          ["AMBYTE_A", "12", "2026-08-17T11:00:00.000Z"],
          [null, "3", "2026-08-17T09:00:00.000Z"],
        ],
        captured,
      );

      const result = await databricksAdapter.getExperimentPublishers(
        "11111111-1111-4111-8111-111111111111",
        FROM,
        TO,
        500,
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        { clientId: "AMBYTE_A", count: 12, lastDataAt: "2026-08-17T11:00:00.000Z" },
        { clientId: null, count: 3, lastDataAt: "2026-08-17T09:00:00.000Z" },
      ]);
      expect(captured.statement).toContain("11111111-1111-4111-8111-111111111111");
      expect(captured.statement).toContain("GROUP BY `client_id`");
      expect(captured.statement).toContain("ORDER BY `last_data_at` DESC");
      expect(captured.statement).toContain("LIMIT 500");
    });

    it("scopes a device series on both the experiment and the client id", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["timestamp_day", "measurement_count"],
        [
          ["2026-09-01T00:00:00.000Z", "12"],
          ["2026-09-02T00:00:00.000Z", "4"],
        ],
        captured,
      );

      const result = await databricksAdapter.getExperimentDeviceSeries(
        "11111111-1111-4111-8111-111111111111",
        "AMBYTE_A",
        FROM,
        TO,
        "day",
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        { bucketStart: "2026-09-01T00:00:00.000Z", count: 12 },
        { bucketStart: "2026-09-02T00:00:00.000Z", count: 4 },
      ]);
      // Both keys, or the chart would show the device's traffic into every experiment.
      expect(captured.statement).toContain("11111111-1111-4111-8111-111111111111");
      expect(captured.statement).toContain("AMBYTE_A");
      expect(captured.statement).toContain("clean_data");
    });

    it("reads device counts from the configured serving view, newest report first", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        [
          "client_id",
          "device_name",
          "device_firmware",
          "device_version",
          "device_battery",
          "total_measurements",
          "processed_timestamp",
        ],
        [
          [
            "AMBYTE_A",
            "shed-logger",
            "ambyte-2",
            "2.4.1",
            "4.18",
            "42",
            "2026-08-17T11:00:00.000Z",
          ],
          [null, null, null, null, null, "3", "2026-08-17T09:00:00.000Z"],
        ],
        captured,
      );

      const result = await databricksAdapter.getExperimentDeviceStats(
        "11111111-1111-4111-8111-111111111111",
        2000,
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        {
          clientId: "AMBYTE_A",
          deviceName: "shed-logger",
          firmware: "ambyte-2",
          version: "2.4.1",
          battery: 4.18,
          totalMeasurements: 42,
          lastReportedAt: "2026-08-17T11:00:00.000Z",
        },
        {
          clientId: null,
          deviceName: null,
          firmware: null,
          version: null,
          battery: null,
          totalMeasurements: 3,
          lastReportedAt: "2026-08-17T09:00:00.000Z",
        },
      ]);
      expect(captured.statement?.match(/\bFROM\s+(\S+)/i)?.[1]).toBe(
        `${databricksAdapter.CATALOG_NAME}.${databricksAdapter.CENTRUM_SCHEMA_NAME}.${databricksAdapter.DEVICE_DATA_TABLE_NAME}`,
      );
      expect(captured.statement).toContain(
        "WHERE `experiment_id` = '11111111-1111-4111-8111-111111111111'",
      );
      expect(captured.statement).toContain("ORDER BY `processed_timestamp` DESC");
      expect(captured.statement).toContain("LIMIT 2000");
    });

    it("maps grouped experiment attribution rows", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["timestamp_hour", "experiment_id", "measurement_count"],
        [
          ["2026-08-17T10:00:00.000Z", "exp-1", "7"],
          ["2026-08-17T11:00:00.000Z", null, "2"],
        ],
        captured,
      );

      const result = await databricksAdapter.getDevicesDataByExperiment(
        THINGS,
        FROM,
        TO,
        "hour",
        50,
      );

      assertSuccess(result);
      expect(result.value).toEqual([
        { bucketStart: "2026-08-17T10:00:00.000Z", experimentId: "exp-1", count: 7 },
        { bucketStart: "2026-08-17T11:00:00.000Z", experimentId: null, count: 2 },
      ]);
      expect(captured.statement).toContain("LIMIT 50");
    });

    it("maps firmware sightings per thing and version", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["client_id", "device_version", "last_seen"],
        [["AMBYTE_A", "1.1.0", "2026-08-17T11:00:00.000Z"]],
        captured,
      );

      const result = await databricksAdapter.getDevicesFirmware(THINGS, FROM, TO, 50);

      assertSuccess(result);
      expect(result.value).toEqual([
        { clientId: "AMBYTE_A", version: "1.1.0", lastSeen: "2026-08-17T11:00:00.000Z" },
      ]);
      // Newest-first ordering: a hit ceiling can only shed stale sightings.
      expect(captured.statement).toContain("ORDER BY `last_seen` DESC");
      expect(captured.statement).toContain("LIMIT 50");
    });

    it("maps lifecycle events newest-first with the group-wide cap", async () => {
      const captured: CapturedStatement = {};
      mockGroupSql(
        ["client_id", "event_type", "event_timestamp", "disconnect_reason"],
        [["AMBYTE_A", "disconnected", "2026-08-17T12:00:00.000Z", "CONNECTION_LOST"]],
        captured,
      );

      const result = await databricksAdapter.getDevicesLifecycleEvents(THINGS, FROM, TO, 200);

      assertSuccess(result);
      expect(result.value).toEqual([
        {
          clientId: "AMBYTE_A",
          eventType: "disconnected",
          eventTimestamp: "2026-08-17T12:00:00.000Z",
          disconnectReason: "CONNECTION_LOST",
        },
      ]);
      expect(captured.statement).toContain("LIMIT 200");
      expect(captured.statement).toContain("DESC");
    });

    it("answers an empty member set without touching the warehouse", async () => {
      // No nock mounts: any HTTP call would throw.
      const activity = await databricksAdapter.getDevicesLastActivity([]);
      const throughput = await databricksAdapter.getDevicesThroughput([], FROM, TO, "hour", 1);
      const experiments = await databricksAdapter.getDevicesDataByExperiment(
        [],
        FROM,
        TO,
        "hour",
        1,
      );
      const firmware = await databricksAdapter.getDevicesFirmware([], FROM, TO, 1);
      const events = await databricksAdapter.getDevicesLifecycleEvents([], FROM, TO, 1);

      assertSuccess(activity);
      expect(activity.value.size).toBe(0);
      const lists: Result<unknown[]>[] = [throughput, experiments, firmware, events];
      for (const result of lists) {
        assertSuccess(result);
        expect(result.value).toEqual([]);
      }
    });

    const scans: [string, () => Promise<{ isFailure: () => boolean }>][] = [
      ["last activity", () => databricksAdapter.getDevicesLastActivity(THINGS)],
      ["throughput", () => databricksAdapter.getDevicesThroughput(THINGS, FROM, TO, "hour", 50)],
      [
        "data by experiment",
        () => databricksAdapter.getDevicesDataByExperiment(THINGS, FROM, TO, "hour", 50),
      ],
      ["firmware", () => databricksAdapter.getDevicesFirmware(THINGS, FROM, TO, 50)],
      [
        "lifecycle events",
        () => databricksAdapter.getDevicesLifecycleEvents(THINGS, FROM, TO, 200),
      ],
    ];

    it.each(scans)("propagates a SQL failure from the %s scan", async (_name, scan) => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(500, { message: "warehouse down" });

      const result = await scan();

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("public metrics", () => {
    const mockToken = () =>
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

    const mockSqlResponse = (columns: string[], rows: (string | null)[][]) =>
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: columns.length,
              columns: columns.map((name, position) => ({
                name,
                type_name: "STRING",
                type_text: "STRING",
                position,
              })),
            },
            total_row_count: rows.length,
            truncated: false,
          },
          result: {
            data_array: rows,
            chunk_index: 0,
            row_count: rows.length,
            row_offset: 0,
          },
        });

    it("maps the platform totals row and returns null when empty", async () => {
      mockToken();
      mockSqlResponse(
        [
          "total_measurements",
          "total_volume_bytes",
          "devices_all_time",
          "experiments_with_data",
          "first_measurement_at",
          "last_measurement_at",
          "total_macro_executions",
          "total_uploaded_rows",
          "computed_at",
        ],
        [
          [
            "1000",
            "949000",
            "9",
            "5",
            "2024-01-01 00:00:00",
            "2026-08-14 10:00:00",
            "200",
            "50",
            "2026-08-14 10:05:00",
          ],
        ],
      );

      const result = await databricksAdapter.getPublicPlatformTotals();

      assertSuccess(result);
      expect(result.value).toEqual({
        totalMeasurements: 1000,
        totalVolumeBytes: 949000,
        devicesAllTime: 9,
        experimentsWithData: 5,
        firstMeasurementAt: "2024-01-01T00:00:00.000Z",
        lastMeasurementAt: "2026-08-14T10:00:00.000Z",
        totalMacroExecutions: 200,
        totalUploadedRows: 50,
        computedAt: "2026-08-14T10:05:00.000Z",
      });

      mockToken();
      mockSqlResponse(["total_measurements"], []);
      const empty = await databricksAdapter.getPublicPlatformTotals();
      assertSuccess(empty);
      expect(empty.value).toBeNull();
    });

    it("reads blank numeric cells as absent, never as zero", async () => {
      mockToken();
      mockSqlResponse(["total_measurements", "computed_at"], [["   ", "2026-08-14 10:05:00"]]);
      const totals = await databricksAdapter.getPublicPlatformTotals();
      assertSuccess(totals);
      expect(totals.value).toBeNull();
    });

    it("passes a warehouse failure through every reader", async () => {
      const readers: (() => Promise<Result<unknown>>)[] = [
        () => databricksAdapter.getPublicPlatformTotals(),
        () => databricksAdapter.getPublicDailyActivity(30),
        () => databricksAdapter.getPublicFamilyTotals(),
        () => databricksAdapter.getActivityWindows(),
        () => databricksAdapter.getHourlyActivity(),
        () => databricksAdapter.getTopParameter("derived"),
        () => databricksAdapter.getPoolFacts(),
        () => databricksAdapter.getScopedDailyActivity(30),
        () => databricksAdapter.getContributorPairs(),
        () => databricksAdapter.getDevicePairs(),
      ];

      for (const read of readers) {
        mockToken();
        nock(databricksHost)
          .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
          .reply(500, { message: "warehouse down" });
        assertFailure(await read());
      }
    });

    it("fails the read when the warehouse truncates the result", async () => {
      mockToken();
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 2,
              columns: [
                { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 0 },
                { name: "user_id", type_name: "STRING", type_text: "STRING", position: 1 },
              ],
            },
            total_row_count: 1,
            truncated: true,
          },
          result: { data_array: [["e1", "u1"]], chunk_index: 0, row_count: 1 },
        });

      assertFailure(await databricksAdapter.getContributorPairs());
    });

    it("reads empty single-row tables as null", async () => {
      mockToken();
      mockSqlResponse(["measurements_24h"], []);
      const windows = await databricksAdapter.getActivityWindows();
      assertSuccess(windows);
      expect(windows.value).toBeNull();

      mockToken();
      mockSqlResponse(["parameter"], []);
      const parameter = await databricksAdapter.getTopParameter("derived");
      assertSuccess(parameter);
      expect(parameter.value).toBeNull();

      mockToken();
      mockSqlResponse(["session_median_measurements"], []);
      const pool = await databricksAdapter.getPoolFacts();
      assertSuccess(pool);
      expect(pool.value).toBeNull();
    });

    it("reads rows with blank essentials as null and absent timestamps as null", async () => {
      mockToken();
      mockSqlResponse(
        [
          "measurements_24h",
          "measurements_30d",
          "experiments_30d",
          "contributors_30d",
          "devices_30d",
          "last_measurement_at",
          "computed_at",
        ],
        [["140", "", "23", "31", "12", "2026-08-28 10:00:00", "2026-08-28 10:05:00"]],
      );
      const windows = await databricksAdapter.getActivityWindows();
      assertSuccess(windows);
      expect(windows.value).toBeNull();

      mockToken();
      mockSqlResponse(
        ["parameter", "category", "observations", "median_value"],
        [["Phi2", "derived", "4214", ""]],
      );
      const parameter = await databricksAdapter.getTopParameter("derived");
      assertSuccess(parameter);
      expect(parameter.value).toBeNull();

      mockToken();
      mockSqlResponse(["total_measurements"], [["1000"]]);
      const totals = await databricksAdapter.getPublicPlatformTotals();
      assertSuccess(totals);
      expect(totals.value?.computedAt).toBeNull();
      expect(totals.value?.lastMeasurementAt).toBeNull();
    });

    it("drops malformed rows instead of inventing values", async () => {
      mockToken();
      mockSqlResponse(
        ["date", "measurements", "cumulative_measurements", "volume_bytes"],
        [
          ["2026-08-14", "10", "1000", "200000"],
          [null, "10", "1000", "200000"],
          ["2026-08-15", "not-a-number", "1010", "200000"],
        ],
      );
      const daily = await databricksAdapter.getPublicDailyActivity(30);
      assertSuccess(daily);
      expect(daily.value).toEqual([
        { date: "2026-08-14", measurements: 10, cumulativeMeasurements: 1000, volumeBytes: 200000 },
      ]);

      // A totals row without its core figure reads as no data, not zero.
      mockToken();
      mockSqlResponse(["computed_at"], [["2026-08-14 10:05:00"]]);
      const totals = await databricksAdapter.getPublicPlatformTotals();
      assertSuccess(totals);
      expect(totals.value).toBeNull();

      mockToken();
      mockSqlResponse(
        ["hour_local", "measurements"],
        [
          ["12", "300"],
          ["25", "300"],
          [null, "300"],
        ],
      );
      const hourly = await databricksAdapter.getHourlyActivity();
      assertSuccess(hourly);
      expect(hourly.value).toEqual([{ hourLocal: 12, measurements: 300 }]);
    });

    it("returns per-resource daily activity and drops rows missing an essential", async () => {
      mockToken();
      mockSqlResponse(
        ["date", "resource_type", "resource_id", "measurements"],
        [
          ["2026-08-14", "protocol", "p1", "10"],
          ["2026-08-15", "protocol", "p1", "12"],
          ["2026-08-15", "protocol", null, "12"],
          ["2026-08-15", "protocol", "p2", "not-a-number"],
        ],
      );

      const result = await databricksAdapter.getResourceDailyActivity("protocol", 30);

      assertSuccess(result);
      expect(result.value).toEqual([
        { date: "2026-08-14", resourceType: "protocol", resourceId: "p1", measurements: 10 },
        { date: "2026-08-15", resourceType: "protocol", resourceId: "p1", measurements: 12 },
      ]);
    });

    it("returns daily activity ascending with volume", async () => {
      mockToken();
      mockSqlResponse(
        ["date", "measurements", "cumulative_measurements", "volume_bytes", "computed_at"],
        [
          ["2026-08-14", "10", "1000", "200000", "x"],
          ["2026-08-13", "20", "990", "400000", "x"],
        ],
      );

      const result = await databricksAdapter.getPublicDailyActivity(366);

      assertSuccess(result);
      expect(result.value).toEqual([
        { date: "2026-08-13", measurements: 20, cumulativeMeasurements: 990, volumeBytes: 400000 },
        { date: "2026-08-14", measurements: 10, cumulativeMeasurements: 1000, volumeBytes: 200000 },
      ]);
    });

    it("maps family totals to the public shape", async () => {
      mockToken();
      mockSqlResponse(
        ["family", "total_measurements", "devices_all_time", "computed_at"],
        [["multispeq", "900", "7", "x"]],
      );

      const result = await databricksAdapter.getPublicFamilyTotals();

      assertSuccess(result);
      expect(result.value).toEqual([{ family: "multispeq", measurements: 900 }]);
    });

    it("maps the activity windows row", async () => {
      mockToken();
      mockSqlResponse(
        [
          "measurements_24h",
          "measurements_30d",
          "experiments_30d",
          "contributors_30d",
          "devices_30d",
          "last_measurement_at",
          "computed_at",
        ],
        [["140", "4812", "23", "31", "12", "2026-08-28 10:00:00", "2026-08-28 10:05:00"]],
      );

      const result = await databricksAdapter.getActivityWindows();

      assertSuccess(result);
      expect(result.value).toEqual({
        measurements24h: 140,
        measurements30d: 4812,
        experiments30d: 23,
        contributors30d: 31,
        devices30d: 12,
        lastMeasurementAt: "2026-08-28T10:00:00.000Z",
        computedAt: "2026-08-28T10:05:00.000Z",
      });
    });

    it("maps hourly bins, the top parameter, and pool facts", async () => {
      mockToken();
      mockSqlResponse(["hour_local", "measurements", "computed_at"], [["12", "300", "x"]]);
      const hourly = await databricksAdapter.getHourlyActivity();
      assertSuccess(hourly);
      expect(hourly.value).toEqual([{ hourLocal: 12, measurements: 300 }]);

      mockToken();
      mockSqlResponse(
        ["parameter", "label", "category", "observations", "median_value", "computed_at"],
        [["Phi2", "Photosystem II efficiency", "derived", "4214", "0.62", "x"]],
      );
      const parameter = await databricksAdapter.getTopParameter("derived");
      assertSuccess(parameter);
      expect(parameter.value).toEqual({
        label: "Photosystem II efficiency",
        name: "Phi2",
        observations: 4214,
        median: 0.62,
      });

      mockToken();
      mockSqlResponse(
        [
          "session_median_measurements",
          "device_endurance_days",
          "simultaneity_peak_devices",
          "timezones_all_time",
          "timezones_peak_day",
          "mean_arrival_gap_seconds",
          "current_streak_days",
          "computed_at",
        ],
        [["45", null, "14", "14", "9", "0.25", "12", "x"]],
      );
      const pool = await databricksAdapter.getPoolFacts();
      assertSuccess(pool);
      expect(pool.value).toEqual({
        sessionMedianMeasurements: 45,
        meanArrivalGapSeconds: 0.25,
        currentStreakDays: 12,
        deviceEnduranceDays: null,
        simultaneityPeakDevices: 14,
        timezonesAllTime: 14,
        timezonesPeakDay: 9,
      });
    });

    it("maps scoped rows and contributor pairs", async () => {
      mockToken();
      mockSqlResponse(
        ["date", "experiment_id", "measurements", "computed_at"],
        [["2026-08-28", "exp-1", "300", "x"]],
      );
      const scoped = await databricksAdapter.getScopedDailyActivity(30);
      assertSuccess(scoped);
      expect(scoped.value).toEqual([
        { date: "2026-08-28", experimentId: "exp-1", measurements: 300 },
      ]);

      mockToken();
      mockSqlResponse(["experiment_id", "user_id", "computed_at"], [["exp-1", "user-1", "x"]]);
      const pairs = await databricksAdapter.getContributorPairs();
      assertSuccess(pairs);
      expect(pairs.value).toEqual([{ experimentId: "exp-1", userId: "user-1" }]);

      mockToken();
      mockSqlResponse(
        ["experiment_id", "client_id", "computed_at"],
        [
          ["exp-1", "logger-1", "x"],
          ["exp-1", null, "x"],
        ],
      );
      const devices = await databricksAdapter.getDevicePairs();
      assertSuccess(devices);
      // A row without a publisher names no device, so it is dropped.
      expect(devices.value).toEqual([{ experimentId: "exp-1", clientId: "logger-1" }]);
    });
  });
});
