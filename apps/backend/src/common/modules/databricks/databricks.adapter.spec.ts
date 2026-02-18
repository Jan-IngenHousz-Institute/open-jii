import nock from "nock";

import { TestHarness } from "../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../utils/fp-utils";
import { DatabricksAdapter } from "./databricks.adapter";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import { DatabricksSqlService } from "./services/sql/sql.service";
import { DatabricksWorkspaceService } from "./services/workspace/workspace.service";

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

  describe("triggerAmbyteProcessingJob", () => {
    it("should successfully trigger ambyte processing job", async () => {
      const mockParams = {
        EXPERIMENT_ID: "exp-123",
        YEAR_PREFIX: "2025",
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
      nock(databricksHost)
        .post(
          `${DatabricksJobsService.JOBS_ENDPOINT}/run-now`,
          (body: { job_parameters?: Record<string, string> }) => {
            return (
              body.job_parameters?.CATALOG_NAME === "main" &&
              body.job_parameters.EXPERIMENT_ID === "exp-123" &&
              body.job_parameters.YEAR_PREFIX === "2025"
            );
          },
        )
        .reply(200, mockResponse);

      // Execute trigger ambyte processing job
      const result = await databricksAdapter.triggerAmbyteProcessingJob(mockParams);

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
          { name: "table_name", type_name: "string", type_text: "string" },
          { name: "row_count", type_name: "bigint", type_text: "bigint" },
          { name: "macro_schema", type_name: "string", type_text: "string" },
          { name: "questions_schema", type_name: "string", type_text: "string" },
        ],
        rows: [
          ["raw_data", "100", null, null],
          ["device", "50", null, null],
          ["some_macro", "25", '{"col1":"int"}', '{"q1":"text"}'],
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
        { tableName: "raw_data", rowCount: 100, macroSchema: null, questionsSchema: null },
        { tableName: "device", rowCount: 50, macroSchema: null, questionsSchema: null },
        {
          tableName: "some_macro",
          rowCount: 25,
          macroSchema: '{"col1":"int"}',
          questionsSchema: '{"q1":"text"}',
        },
      ]);
    });

    it("should retrieve metadata for specific table only", async () => {
      const mockMetadata = {
        columns: [
          { name: "table_name", type_name: "string", type_text: "string" },
          { name: "row_count", type_name: "bigint", type_text: "bigint" },
          { name: "macro_schema", type_name: "string", type_text: "string" },
          { name: "questions_schema", type_name: "string", type_text: "string" },
        ],
        rows: [["device", "50", null, null]],
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
        tableName: "device",
      });

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([
        { tableName: "device", rowCount: 50, macroSchema: null, questionsSchema: null },
      ]);
    });

    it("should exclude schemas when includeSchemas is false", async () => {
      const mockMetadata = {
        columns: [
          { name: "table_name", type_name: "string", type_text: "string" },
          { name: "row_count", type_name: "bigint", type_text: "bigint" },
        ],
        rows: [
          ["raw_data", "100"],
          ["device", "50"],
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
        { tableName: "raw_data", rowCount: 100 },
        { tableName: "device", rowCount: 50 },
      ]);
    });
  });

  describe("buildExperimentQuery", () => {
    it("should build query for standard tables (raw_data, device, raw_ambyte_data)", () => {
      const query = databricksAdapter.buildExperimentQuery({
        tableName: "raw_data",
        experimentId: "exp-123",
        columns: ["id", "timestamp"],
      });

      expect(query).toContain("SELECT `id`, `timestamp`");
      expect(query).toContain("WHERE `experiment_id` = 'exp-123'");
      expect(query).toContain(databricksAdapter.RAW_DATA_TABLE_NAME);
    });

    it("should build query for macro tables with macro_filename filter", () => {
      const query = databricksAdapter.buildExperimentQuery({
        tableName: "some_macro_name",
        experimentId: "exp-123",
        columns: ["id", "data"],
      });

      expect(query).toContain("SELECT `id`, `data`");
      expect(query).toContain("WHERE `experiment_id` = 'exp-123'");
      expect(query).toContain("`macro_filename` = 'some_macro_name'");
      expect(query).toContain(databricksAdapter.MACRO_DATA_TABLE_NAME);
    });

    it("should handle VARIANT columns parsing", () => {
      const query = databricksAdapter.buildExperimentQuery({
        tableName: "device",
        experimentId: "exp-123",
        variants: [{ columnName: "data", schema: '{"field1":"int"}' }],
      });

      expect(query).toContain("SELECT");
      expect(query).toContain("* EXCEPT (data, parsed_data)");
      expect(query).toContain("parsed_data.*");
      expect(query).toContain('from_json(data::string, \'{"field1":"int"}\') as parsed_data');
    });

    it("should handle all query options (limit, offset, orderBy)", () => {
      const query = databricksAdapter.buildExperimentQuery({
        tableName: "raw_data",
        experimentId: "exp-123",
        columns: ["id", "timestamp"],
        orderBy: "timestamp",
        orderDirection: "DESC",
        limit: 100,
        offset: 50,
      });

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
      const expectedFilePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

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
      const expectedFilePath = `/Volumes/${catalogName}/${testSchemaName}/data-uploads/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

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

  describe("uploadMacroCode", () => {
    const macroData = {
      filename: "some_macro_17",
      code: 'print("Hello, World!")',
      language: "python" as const,
    };

    it("should successfully upload macro code to workspace with filename and extension", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace import API call
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT)
        .reply(200, {});

      // Execute upload macro code
      const result = await databricksAdapter.uploadMacroCode(macroData);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({});
    });

    it("should format filename correctly for different languages", async () => {
      const testCases: {
        filename: string;
        language: string;
        expectedPath: string;
      }[] = [
        {
          filename: "some_macro_17",
          language: "python",
          expectedPath: "/Shared/macros/some_macro_17.py",
        },
        {
          filename: "r_analysis_script",
          language: "r",
          expectedPath: "/Shared/macros/r_analysis_script.r",
        },
        {
          filename: "javascript_helper",
          language: "javascript",
          expectedPath: "/Shared/macros/javascript_helper.js",
        },
        {
          filename: "unknown_language_macro",
          language: "unknown",
          expectedPath: "/Shared/macros/unknown_language_macro",
        },
      ];

      for (const testCase of testCases) {
        // Mock token request
        nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
          access_token: MOCK_ACCESS_TOKEN,
          expires_in: MOCK_EXPIRES_IN,
          token_type: "Bearer",
        });

        // Mock workspace import API call - capture the request to verify path
        nock(databricksHost)
          .post(DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT)
          .reply(200, {});

        // Execute upload macro code
        const result = await databricksAdapter.uploadMacroCode({
          filename: testCase.filename,
          code: "test code",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          language: testCase.language as any, // Type assertion for test case
        });

        // Assert result is success
        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
      }
    });

    it("should handle upload failure from Databricks workspace API", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace import API call with error
      nock(databricksHost).post(DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT).reply(400, {
        error_code: "INVALID_REQUEST",
        message: "Invalid workspace path",
      });

      // Execute upload macro code
      const result = await databricksAdapter.uploadMacroCode(macroData);

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to import workspace object");
    });
  });

  describe("deleteMacroCode", () => {
    const filename = "some_test_macro_123";

    it("should successfully delete macro code from workspace with filename", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace delete API call - the adapter tries multiple extensions
      nock(databricksHost)
        .post(DatabricksWorkspaceService.WORKSPACE_DELETE_ENDPOINT)
        .reply(200, {});

      // Execute delete macro code
      const result = await databricksAdapter.deleteMacroCode(filename);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({});
    });

    it("should handle delete failure when macro does not exist", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock workspace delete API calls - try all extensions and fail
      const extensions = [".py", ".r", ".js", ""];
      for (const _ext of extensions) {
        nock(databricksHost).post(DatabricksWorkspaceService.WORKSPACE_DELETE_ENDPOINT).reply(404, {
          error_code: "RESOURCE_DOES_NOT_EXIST",
          message: "Workspace object does not exist",
        });
      }

      // Execute delete macro code
      const result = await databricksAdapter.deleteMacroCode(filename);

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to delete workspace object");
    });

    it("should handle authentication failure during delete", async () => {
      // Mock token request failure
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(401, {
        error: "invalid_client",
        error_description: "Invalid client credentials",
      });

      // Execute delete macro code
      const result = await databricksAdapter.deleteMacroCode(filename);

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to delete workspace object");
    });
  });

  describe("triggerDataExportJob", () => {
    it("should successfully trigger data export job with correct params", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";
      const format = "csv";
      const userId = "user-123";

      const mockResponse = {
        run_id: 99999,
        number_in_job: 1,
      };

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue("main");

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request - verify all params are passed
      nock(databricksHost)
        .post(
          `${DatabricksJobsService.JOBS_ENDPOINT}/run-now`,
          (body: { job_parameters?: Record<string, string> }) => {
            const params = body.job_parameters;
            if (!params) return false;
            return (
              params.EXPERIMENT_ID === experimentId &&
              params.TABLE_NAME === tableName &&
              params.FORMAT === format &&
              params.USER_ID === userId &&
              params.CATALOG_NAME === "main"
            );
          },
        )
        .reply(200, mockResponse);

      const result = await databricksAdapter.triggerDataExportJob(
        experimentId,
        tableName,
        format,
        userId,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API failure when triggering data export job", async () => {
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue("main");

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request with error
      nock(databricksHost)
        .post(`${DatabricksJobsService.JOBS_ENDPOINT}/run-now`)
        .reply(500, { message: "Internal server error" });

      const result = await databricksAdapter.triggerDataExportJob(
        "exp-1",
        "raw_data",
        "csv",
        "user-1",
      );

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks job trigger");
    });
  });

  describe("streamExport", () => {
    it("should successfully stream an export file", async () => {
      const exportId = "export-abc";
      const experimentId = "exp-456";
      const filePath = "/volumes/catalog/schema/exports/export-abc/raw_data.csv";

      // Mock token request for SQL query
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL query to fetch export metadata
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "stmt-1",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 3,
              columns: [
                { name: "export_id", type_name: "string", type_text: "string", position: 0 },
                { name: "file_path", type_name: "string", type_text: "string", position: 1 },
                { name: "table_name", type_name: "string", type_text: "string", position: 2 },
              ],
            },
            total_row_count: 1,
            truncated: false,
          },
          result: {
            data_array: [[exportId, filePath, "raw_data"]],
            chunk_index: 0,
            row_count: 1,
            row_offset: 0,
          },
        });

      // Mock token request for file download
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file download
      nock(databricksHost)
        .get(`${DatabricksFilesService.FILES_ENDPOINT}${filePath}`)
        .reply(200, "csv-content", { "content-type": "text/csv" });

      const result = await databricksAdapter.streamExport(exportId, experimentId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.filePath).toBe(filePath);
      expect(result.value.tableName).toBe("raw_data");
      expect(result.value.stream).toBeInstanceOf(Object);
    });

    it("should return not found when export does not exist", async () => {
      const exportId = "nonexistent-export";
      const experimentId = "exp-456";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL query returning empty results
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "stmt-2",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 2,
              columns: [
                { name: "export_id", type_name: "string", type_text: "string", position: 0 },
                { name: "file_path", type_name: "string", type_text: "string", position: 1 },
              ],
            },
            total_row_count: 0,
            truncated: false,
          },
          result: {
            data_array: [],
            chunk_index: 0,
            row_count: 0,
            row_offset: 0,
          },
        });

      const result = await databricksAdapter.streamExport(exportId, experimentId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("Export not found");
    });

    it("should return internal error when table name is missing", async () => {
      const exportId = "export-abc";
      const experimentId = "exp-456";
      const filePath = "/volumes/catalog/schema/exports/export-abc/raw_data.csv";

      // Mock token request for SQL query
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL query returning row with file_path but no table_name
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "stmt-3",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 3,
              columns: [
                { name: "export_id", type_name: "string", type_text: "string", position: 0 },
                { name: "file_path", type_name: "string", type_text: "string", position: 1 },
                { name: "table_name", type_name: "string", type_text: "string", position: 2 },
              ],
            },
            total_row_count: 1,
            truncated: false,
          },
          result: {
            data_array: [[exportId, filePath, null]],
            chunk_index: 0,
            row_count: 1,
            row_offset: 0,
          },
        });

      const result = await databricksAdapter.streamExport(exportId, experimentId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("Export table name is missing");
    });
  });

  describe("getExportMetadata", () => {
    it("should return export metadata from Delta Lake", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL query for completed exports
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(200, {
          statement_id: "stmt-3",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 4,
              columns: [
                { name: "export_id", type_name: "string", type_text: "string", position: 0 },
                { name: "status", type_name: "string", type_text: "string", position: 1 },
                { name: "file_path", type_name: "string", type_text: "string", position: 2 },
                { name: "created_at", type_name: "string", type_text: "string", position: 3 },
              ],
            },
            total_row_count: 2,
            truncated: false,
          },
          result: {
            data_array: [
              ["export-1", "completed", "/path/to/file1.csv", "2026-01-01T00:00:00Z"],
              ["export-2", "completed", "/path/to/file2.csv", "2025-12-31T00:00:00Z"],
            ],
            chunk_index: 0,
            row_count: 2,
            row_offset: 0,
          },
        });

      const result = await databricksAdapter.getExportMetadata(experimentId, tableName);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.rows).toHaveLength(2);
    });

    it("should handle SQL query failure", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL query with failure
      nock(databricksHost)
        .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
        .reply(500, { message: "Query failed" });

      const result = await databricksAdapter.getExportMetadata(experimentId, tableName);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });
  });

  describe("getActiveExports", () => {
    it("should return active exports filtered by experiment and table", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 111,
              job_id: 42,
              number_in_job: 1,
              state: { life_cycle_state: "RUNNING" },
              start_time: Date.now(),
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "TABLE_NAME", value: tableName },
                { name: "FORMAT", value: "csv" },
                { name: "USER_ID", value: "user-1" },
              ],
            },
            {
              run_id: 222,
              job_id: 42,
              number_in_job: 2,
              state: { life_cycle_state: "PENDING" },
              start_time: Date.now(),
              job_parameters: [
                { name: "EXPERIMENT_ID", value: "other-exp" },
                { name: "TABLE_NAME", value: "other_table" },
                { name: "FORMAT", value: "ndjson" },
                { name: "USER_ID", value: "user-2" },
              ],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveExports(experimentId, tableName);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      // Only one run matches experimentId and tableName
      expect(result.value).toHaveLength(1);
      expect(result.value[0].experimentId).toBe(experimentId);
      expect(result.value[0].tableName).toBe(tableName);
      expect(result.value[0].status).toBe("running");
      expect(result.value[0].jobRunId).toBe(111);
    });

    it("should return empty array when no active runs exist", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API with no runs
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          has_more: false,
        });

      const result = await databricksAdapter.getActiveExports(experimentId, tableName);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle API failure when listing runs", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API with error
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(500, { message: "Internal server error" });

      const result = await databricksAdapter.getActiveExports(experimentId, tableName);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });

    it("should include INTERNAL_ERROR runs as failed", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API with INTERNAL_ERROR run
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 333,
              job_id: 42,
              number_in_job: 1,
              state: { life_cycle_state: "INTERNAL_ERROR" },
              start_time: Date.now(),
              end_time: Date.now(),
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "TABLE_NAME", value: tableName },
                { name: "FORMAT", value: "parquet" },
                { name: "USER_ID", value: "user-1" },
              ],
            },
          ],
          has_more: false,
        });

      const result = await databricksAdapter.getActiveExports(experimentId, tableName);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].status).toBe("failed");
      expect(result.value[0].jobRunId).toBe(333);
    });
  });

  describe("getFailedExports", () => {
    it("should return failed exports filtered by experiment and table", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock completed runs list API
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 111,
              job_id: 42,
              number_in_job: 1,
              state: { life_cycle_state: "TERMINATED", result_state: "FAILED" },
              start_time: Date.now() - 60000,
              end_time: Date.now(),
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "TABLE_NAME", value: tableName },
                { name: "FORMAT", value: "csv" },
                { name: "USER_ID", value: "user-1" },
              ],
            },
            {
              run_id: 222,
              job_id: 42,
              number_in_job: 2,
              state: { life_cycle_state: "TERMINATED", result_state: "SUCCESS" },
              start_time: Date.now() - 120000,
              end_time: Date.now() - 60000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "TABLE_NAME", value: tableName },
                { name: "FORMAT", value: "ndjson" },
                { name: "USER_ID", value: "user-2" },
              ],
            },
            {
              run_id: 333,
              job_id: 42,
              number_in_job: 3,
              state: { life_cycle_state: "TERMINATED", result_state: "CANCELED" },
              start_time: Date.now() - 180000,
              end_time: Date.now() - 120000,
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "TABLE_NAME", value: tableName },
                { name: "FORMAT", value: "parquet" },
                { name: "USER_ID", value: "user-3" },
              ],
            },
          ],
          has_more: false,
        });

      // Run 222 (SUCCESS) should be in completedExportRunIds
      const completedExportRunIds = new Set([222]);

      const result = await databricksAdapter.getFailedExports(
        experimentId,
        tableName,
        completedExportRunIds,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      // Run 111 (FAILED) and run 333 (CANCELED) should be returned, but not 222 (SUCCESS)
      expect(result.value).toHaveLength(2);
      expect(result.value[0].status).toBe("failed");
      expect(result.value[0].jobRunId).toBe(111);
      expect(result.value[1].status).toBe("failed");
      expect(result.value[1].jobRunId).toBe(333);
    });

    it("should exclude runs already in completed exports", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock completed runs list API
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          runs: [
            {
              run_id: 111,
              job_id: 42,
              number_in_job: 1,
              state: { life_cycle_state: "TERMINATED", result_state: "FAILED" },
              start_time: Date.now(),
              end_time: Date.now(),
              job_parameters: [
                { name: "EXPERIMENT_ID", value: experimentId },
                { name: "TABLE_NAME", value: tableName },
                { name: "FORMAT", value: "csv" },
                { name: "USER_ID", value: "user-1" },
              ],
            },
          ],
          has_more: false,
        });

      // This run ID is already in the completed exports, so it should be excluded
      const completedExportRunIds = new Set([111]);

      const result = await databricksAdapter.getFailedExports(
        experimentId,
        tableName,
        completedExportRunIds,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should return empty array when no completed runs exist", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API with no runs
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(200, {
          has_more: false,
        });

      const result = await databricksAdapter.getFailedExports(experimentId, tableName, new Set());

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle API failure when listing completed runs", async () => {
      const experimentId = "exp-456";
      const tableName = "raw_data";

      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getDataExportJobIdAsNumber").mockReturnValue(42);

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API with error
      nock(databricksHost)
        .get(`${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`)
        .query(true)
        .reply(500, { message: "Internal server error" });

      const result = await databricksAdapter.getFailedExports(experimentId, tableName, new Set());

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });
  });
});
