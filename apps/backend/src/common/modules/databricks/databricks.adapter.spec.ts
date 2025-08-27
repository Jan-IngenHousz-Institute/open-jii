import nock from "nock";

import { TestHarness } from "../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../utils/fp-utils";
import { DatabricksAdapter } from "./databricks.adapter";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import { DatabricksPipelinesService } from "./services/pipelines/pipelines.service";
import { DatabricksSqlService } from "./services/sql/sql.service";
import { DatabricksTablesService } from "./services/tables/tables.service";

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

  describe("triggerJob", () => {
    it("should successfully trigger a job", async () => {
      const mockParams = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-456",
      };

      const mockResponse = {
        run_id: 12345,
        number_in_job: 1,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request
      nock(databricksHost)
        .post(`${DatabricksJobsService.JOBS_ENDPOINT}/run-now`)
        .reply(200, mockResponse);

      // Execute trigger job
      const result = await databricksAdapter.triggerJob(mockParams);

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

  describe("listTables", () => {
    const experimentName = "test_experiment";
    const experimentId = "123";
    const schemaName = `exp_${experimentName}_${experimentId}`;

    it("should successfully list tables", async () => {
      const mockTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: schemaName,
            table_type: "MANAGED",
            comment: "Bronze data table",
            created_at: 1620000000000,
          },
          {
            name: "silver_data",
            catalog_name: "test_catalog",
            schema_name: schemaName,
            table_type: "MANAGED",
            comment: "Silver data table",
            created_at: 1620000000001,
          },
        ],
        next_page_token: null,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock tables list API call
      nock(databricksHost)
        .get(DatabricksTablesService.TABLES_ENDPOINT)
        .query(true)
        .reply(200, mockTablesResponse);

      // Execute list tables
      const result = await databricksAdapter.listTables(experimentName, experimentId);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.tables).toEqual(mockTablesResponse.tables);
    });
  });

  describe("uploadFile", () => {
    const experimentId = "123-456-789";
    const experimentName = "Test Experiment";
    const sourceType = "ambyte";
    const fileName = "data.csv";
    const fileBuffer = Buffer.from("test,data");
    const catalogName = "main";

    it("should correctly format the file path and upload the file", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and file path based on adapter implementation
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId.replace(/-/g, "_")}`;
      const expectedFilePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${fileName}`;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload API call
      nock(databricksHost)
        .post(DatabricksFilesService.FILES_ENDPOINT)
        .query({ path: expectedFilePath, overwrite: "true" })
        .reply(200, {
          file_id: "file-abc123",
        });

      // Execute upload file
      const result = await databricksAdapter.uploadFile(
        experimentId,
        experimentName,
        sourceType,
        fileName,
        fileBuffer,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        fileId: "file-abc123",
        filePath: expectedFilePath,
      });
    });

    it("should handle spaces and special characters in experiment name", async () => {
      const specialExperimentName = "  Test EXPERIMENT with SPACES  ";

      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and file path based on adapter implementation
      const cleanName = specialExperimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId.replace(/-/g, "_")}`;
      const expectedFilePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${fileName}`;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload API call
      nock(databricksHost)
        .post(DatabricksFilesService.FILES_ENDPOINT)
        .query({ path: expectedFilePath, overwrite: "true" })
        .reply(200, {
          file_id: "file-abc123",
        });

      // Execute upload file
      const result = await databricksAdapter.uploadFile(
        experimentId,
        specialExperimentName,
        sourceType,
        fileName,
        fileBuffer,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.filePath).toEqual(expectedFilePath);
    });
  });

  describe("triggerExperimentPipeline", () => {
    const experimentName = "Test Experiment";
    const experimentId = "123-456-789";

    it("should correctly format pipeline name, get pipeline ID, and trigger update", async () => {
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const pipelineName = `exp-${cleanName}-DLT-Pipeline-DEV`;
      const pipelineId = "pipeline-abc123";
      const updateId = "update-xyz789";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock list pipelines to find pipeline by name
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .query(true)
        .reply(200, {
          pipelines: [
            {
              pipeline_id: pipelineId,
              name: pipelineName,
              state: "ACTIVE",
            },
          ],
        });

      // Mock get pipeline details
      nock(databricksHost)
        .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${pipelineId}`)
        .reply(200, {
          pipeline_id: pipelineId,
          name: pipelineName,
          state: "ACTIVE",
        });

      // Mock start pipeline update API call
      nock(databricksHost)
        .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${pipelineId}/updates`)
        .reply(200, {
          update_id: updateId,
        });

      // Execute trigger experiment pipeline
      const result = await databricksAdapter.triggerExperimentPipeline(
        experimentName,
        experimentId,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        update_id: updateId,
      });
    });

    it("should handle failure when pipeline is not found", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock list pipelines with empty results
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .query(true)
        .reply(200, {
          pipelines: [],
        });

      // Execute trigger experiment pipeline
      const result = await databricksAdapter.triggerExperimentPipeline(
        experimentName,
        experimentId,
      );

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("not found");
    });

    it("should handle spaces and uppercase characters in experiment name", async () => {
      const specialExperimentName = "  Test EXPERIMENT with SPACES  ";
      const cleanName = specialExperimentName.toLowerCase().trim().replace(/ /g, "_");
      const pipelineName = `exp-${cleanName}-DLT-Pipeline-DEV`;
      const pipelineId = "pipeline-abc123";
      const updateId = "update-xyz789";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock list pipelines to find pipeline by name
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .query(true)
        .reply(200, {
          pipelines: [
            {
              pipeline_id: pipelineId,
              name: pipelineName,
              state: "ACTIVE",
            },
          ],
        });

      // Mock get pipeline details
      nock(databricksHost)
        .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${pipelineId}`)
        .reply(200, {
          pipeline_id: pipelineId,
          name: pipelineName,
          state: "ACTIVE",
        });

      // Mock start pipeline update API call
      nock(databricksHost)
        .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${pipelineId}/updates`)
        .reply(200, {
          update_id: updateId,
        });

      // Execute trigger experiment pipeline
      const result = await databricksAdapter.triggerExperimentPipeline(
        specialExperimentName,
        experimentId,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        update_id: updateId,
      });
    });
  });
});
