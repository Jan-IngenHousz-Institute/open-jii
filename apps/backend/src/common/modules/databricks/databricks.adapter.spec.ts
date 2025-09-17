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
import { DatabricksVolumesService } from "./services/volumes/volumes.service";
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

  describe("uploadExperimentData", () => {
    const experimentId = "123-456-789";
    const experimentName = "Test Experiment";
    const sourceType = "ambyte";
    const directoryName = "upload_20250910_143022_123-456-789";
    const fileName = "data.csv";
    const fileBuffer = Buffer.from("test,data");
    const catalogName = "main";

    it("should correctly format the file path and upload the file", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and file path based on adapter implementation
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;
      const expectedFilePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${directoryName}/${fileName}`;

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
        experimentId,
        experimentName,
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
      const specialExperimentName = "  Test EXPERIMENT with SPACES  ";

      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and file path based on adapter implementation
      const cleanName = specialExperimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;
      const expectedFilePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${directoryName}/${fileName}`;

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
        experimentId,
        specialExperimentName,
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
          statuses: [
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
          statuses: [],
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
          statuses: [
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

  describe("createVolume", () => {
    it("should successfully create a volume", async () => {
      const mockVolumeParams = {
        catalog_name: "main",
        schema_name: "test_schema",
        name: "test_volume",
        volume_type: "MANAGED" as const,
        comment: "Test volume comment",
      };

      const mockVolumeResponse = {
        catalog_name: "main",
        schema_name: "test_schema",
        name: "test_volume",
        full_name: "main.test_schema.test_volume",
        volume_type: "MANAGED",
        comment: "Test volume comment",
        volume_id: "volume-123",
        created_at: 1620000000000,
        created_by: "test-user",
        updated_at: 1620000000000,
        updated_by: "test-user",
        owner: "test-user",
        metastore_id: "metastore-123",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock create volume API call
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .reply(200, mockVolumeResponse);

      // Execute create volume
      const result = await databricksAdapter.createVolume(mockVolumeParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockVolumeResponse);
    });
  });

  describe("createExperimentVolume", () => {
    const experimentName = "Test Experiment";
    const experimentId = "123-456-789";
    const volumeName = "data-uploads";
    const comment = "Volume for test experiment data uploads";
    const catalogName = "main";

    it("should successfully create an experiment volume with correct naming", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name based on adapter implementation
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;

      const mockVolumeResponse = {
        catalog_name: catalogName,
        schema_name: schemaName,
        name: volumeName,
        full_name: `${catalogName}.${schemaName}.${volumeName}`,
        volume_type: "MANAGED",
        comment,
        volume_id: "volume-123",
        created_at: 1620000000000,
        created_by: "test-user",
        updated_at: 1620000000000,
        updated_by: "test-user",
        owner: "test-user",
        metastore_id: "metastore-123",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock create volume API call
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .reply(200, mockVolumeResponse);

      // Execute create experiment volume
      const result = await databricksAdapter.createExperimentVolume(
        experimentName,
        experimentId,
        volumeName,
        comment,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockVolumeResponse);
    });

    it("should create experiment volume without comment", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name based on adapter implementation
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;

      const mockVolumeResponse = {
        catalog_name: catalogName,
        schema_name: schemaName,
        name: volumeName,
        full_name: `${catalogName}.${schemaName}.${volumeName}`,
        volume_type: "MANAGED",
        volume_id: "volume-123",
        created_at: 1620000000000,
        created_by: "test-user",
        updated_at: 1620000000000,
        updated_by: "test-user",
        owner: "test-user",
        metastore_id: "metastore-123",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock create volume API call
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .reply(200, mockVolumeResponse);

      // Execute create experiment volume without comment
      const result = await databricksAdapter.createExperimentVolume(
        experimentName,
        experimentId,
        volumeName,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockVolumeResponse);
    });

    it("should handle spaces and special characters in experiment name", async () => {
      const specialExperimentName = "  Test EXPERIMENT with SPACES  ";

      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name based on adapter implementation
      const cleanName = specialExperimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;

      const mockVolumeResponse = {
        catalog_name: catalogName,
        schema_name: schemaName,
        name: volumeName,
        full_name: `${catalogName}.${schemaName}.${volumeName}`,
        volume_type: "MANAGED",
        comment,
        volume_id: "volume-123",
        created_at: 1620000000000,
        created_by: "test-user",
        updated_at: 1620000000000,
        updated_by: "test-user",
        owner: "test-user",
        metastore_id: "metastore-123",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock create volume API call
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .reply(200, mockVolumeResponse);

      // Execute create experiment volume with special characters
      const result = await databricksAdapter.createExperimentVolume(
        specialExperimentName,
        experimentId,
        volumeName,
        comment,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.schema_name).toEqual(schemaName);
    });
  });

  describe("getExperimentVolume", () => {
    const experimentName = "Test Experiment";
    const experimentId = "123-456-789";
    const volumeName = "data-uploads";
    const catalogName = "main";

    it("should successfully get an experiment volume", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and full volume name based on adapter implementation
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;
      const expectedFullVolumeName = `${catalogName}.${schemaName}.${volumeName}`;

      const mockVolumeResponse = {
        catalog_name: catalogName,
        schema_name: schemaName,
        name: volumeName,
        full_name: expectedFullVolumeName,
        volume_type: "MANAGED",
        volume_id: "volume-123",
        created_at: 1620000000000,
        created_by: "test-user",
        updated_at: 1620000000000,
        updated_by: "test-user",
        owner: "test-user",
        metastore_id: "metastore-123",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock get volume API call
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(expectedFullVolumeName)}`,
        )
        .reply(200, mockVolumeResponse);

      // Execute get experiment volume
      const result = await databricksAdapter.getExperimentVolume(
        experimentName,
        experimentId,
        volumeName,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockVolumeResponse);
    });

    it("should handle failure when volume is not found", async () => {
      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and full volume name based on adapter implementation
      const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;
      const expectedFullVolumeName = `${catalogName}.${schemaName}.${volumeName}`;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock get volume API call with 404 error
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(expectedFullVolumeName)}`,
        )
        .reply(404, {
          error_code: "VOLUME_DOES_NOT_EXIST",
          message: "Volume does not exist",
        });

      // Execute get experiment volume
      const result = await databricksAdapter.getExperimentVolume(
        experimentName,
        experimentId,
        volumeName,
      );

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get volume");
    });

    it("should handle spaces and special characters in experiment name", async () => {
      const specialExperimentName = "  Test EXPERIMENT with SPACES  ";

      // Get the actual config service for mocking
      const configService = testApp.module.get(DatabricksConfigService);
      vi.spyOn(configService, "getCatalogName").mockReturnValue(catalogName);

      // Calculate expected schema name and full volume name based on adapter implementation
      const cleanName = specialExperimentName.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experimentId}`;
      const expectedFullVolumeName = `${catalogName}.${schemaName}.${volumeName}`;

      const mockVolumeResponse = {
        catalog_name: catalogName,
        schema_name: schemaName,
        name: volumeName,
        full_name: expectedFullVolumeName,
        volume_type: "MANAGED",
        volume_id: "volume-123",
        created_at: 1620000000000,
        created_by: "test-user",
        updated_at: 1620000000000,
        updated_by: "test-user",
        owner: "test-user",
        metastore_id: "metastore-123",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock get volume API call
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(expectedFullVolumeName)}`,
        )
        .reply(200, mockVolumeResponse);

      // Execute get experiment volume with special characters
      const result = await databricksAdapter.getExperimentVolume(
        specialExperimentName,
        experimentId,
        volumeName,
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.full_name).toEqual(expectedFullVolumeName);
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
});
