import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type {
  ErrorResponse,
  ExperimentDataResponse,
  UploadExperimentDataResponse,
  DownloadExperimentDataResponse,
} from "@repo/api";
import { contract } from "@repo/api";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import type { ListTablesResponse } from "../../common/modules/databricks/services/tables/tables.types";
import { success, failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

describe("ExperimentDataController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get the DatabricksAdapter instance
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

  describe("getExperimentData", () => {
    it("should return experiment data successfully when table name is specified", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Data",
        userId: testUserId,
      });

      // Mock the DatabricksAdapter methods
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

      const resultTableData = {
        columns: [
          { name: "column1", type_name: "string", type_text: "string" },
          { name: "column2", type_name: "number", type_text: "number" },
        ],
        rows: [
          { column1: "value1", column2: "1" },
          { column1: "value2", column2: "2" },
        ],
        totalRows: 2,
        truncated: false,
      };

      // Mock listTables to validate table exists
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "test_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock getTableMetadata to return column metadata
      const mockMetadataResponse = new Map<string, string>([
        ["column1", "STRING"],
        ["column2", "NUMBER"],
      ]);

      vi.spyOn(databricksAdapter, "getTableMetadata").mockResolvedValue(
        success(mockMetadataResponse),
      );

      vi.spyOn(databricksAdapter, "executeSqlQuery")
        .mockResolvedValueOnce(success(mockCountData)) // First call for count
        .mockResolvedValueOnce(success(mockTableData)); // Second call for actual data

      // Get the path
      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      // Add query parameters
      const queryParams = {
        tableName: "test_table",
        page: 1,
        pageSize: 5,
      };

      // Make the request
      const response: SuperTestResponse<ExperimentDataResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query(queryParams)
        .expect(StatusCodes.OK);

      // Verify the response structure - now an array with one element
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        name: "test_table",
        catalog_name: experiment.name,
        schema_name: `exp_test_experiment_for_data_${experiment.id}`,
        data: resultTableData,
        page: 1,
        pageSize: 5,
        totalPages: 20, // 100 / 5
        totalRows: 100,
      });

      // Verify the DatabricksAdapter was called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.listTables).toHaveBeenCalledWith(experiment.name, experiment.id);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        1,
        `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        "SELECT COUNT(*) as count FROM test_table",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        "SELECT * FROM test_table LIMIT 5 OFFSET 0",
      );
    });

    it("should return experiment data with ORDER BY when orderBy and orderDirection are provided", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Ordering",
        userId: testUserId,
      });

      // Mock the DatabricksAdapter methods
      const mockCountData = {
        columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
        rows: [["50"]],
        totalRows: 1,
        truncated: false,
      };

      const mockTableData = {
        columns: [
          { name: "timestamp", type_name: "timestamp", type_text: "timestamp" },
          { name: "temperature", type_name: "number", type_text: "number" },
        ],
        rows: [
          ["2023-01-01T12:02:00Z", "25.8"],
          ["2023-01-01T12:01:00Z", "26.0"],
          ["2023-01-01T12:00:00Z", "25.5"],
        ],
        totalRows: 3,
        truncated: false,
      };

      const resultTableData = {
        columns: [
          { name: "timestamp", type_name: "timestamp", type_text: "timestamp" },
          { name: "temperature", type_name: "number", type_text: "number" },
        ],
        rows: [
          { timestamp: "2023-01-01T12:02:00Z", temperature: "25.8" },
          { timestamp: "2023-01-01T12:01:00Z", temperature: "26.0" },
          { timestamp: "2023-01-01T12:00:00Z", temperature: "25.5" },
        ],
        totalRows: 3,
        truncated: false,
      };

      // Mock listTables to validate table exists
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "sensor_data",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      vi.spyOn(databricksAdapter, "executeSqlQuery")
        .mockResolvedValueOnce(success(mockCountData)) // First call for count
        .mockResolvedValueOnce(success(mockTableData)); // Second call for actual data with ORDER BY

      // Get the path
      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      // Add query parameters including orderBy and orderDirection
      const queryParams = {
        tableName: "sensor_data",
        page: 1,
        pageSize: 10,
        orderBy: "timestamp",
        orderDirection: "DESC",
      };

      // Make the request
      const response: SuperTestResponse<ExperimentDataResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query(queryParams)
        .expect(StatusCodes.OK);

      // Verify the response structure
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        name: "sensor_data",
        catalog_name: experiment.name,
        schema_name: `exp_test_experiment_for_ordering_${experiment.id}`,
        data: resultTableData,
        page: 1,
        pageSize: 10,
        totalPages: 5, // 50 / 10
        totalRows: 50,
      });

      // Verify the DatabricksAdapter was called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.listTables).toHaveBeenCalledWith(experiment.name, experiment.id);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        1,
        `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        "SELECT COUNT(*) as count FROM sensor_data",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        "SELECT * FROM sensor_data ORDER BY `timestamp` DESC LIMIT 10 OFFSET 0",
      );
    });

    it("should return tables list with sample data when no table name is specified", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Tables",
        userId: testUserId,
      });

      // Mock the DatabricksAdapter listTables method
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
          {
            name: "silver_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      // Sample data for each table
      const mockBronzeTableData = {
        columns: [
          { name: "id", type_name: "string", type_text: "string" },
          { name: "value", type_name: "number", type_text: "number" },
        ],
        rows: [
          ["1", "100"],
          ["2", "200"],
        ],
        totalRows: 2,
        truncated: false,
      };

      const mockSilverTableData = {
        columns: [
          { name: "id", type_name: "string", type_text: "string" },
          { name: "processed", type_name: "boolean", type_text: "boolean" },
        ],
        rows: [
          ["1", "true"],
          ["2", "false"],
        ],
        totalRows: 2,
        truncated: false,
      };

      // Setup mocks
      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock getTableMetadata to return column metadata
      const mockMetadataResponse = new Map<string, string>([
        ["id", "STRING"],
        ["value", "NUMBER"],
      ]);

      vi.spyOn(databricksAdapter, "getTableMetadata").mockResolvedValue(
        success(mockMetadataResponse),
      );

      vi.spyOn(databricksAdapter, "executeSqlQuery")
        .mockResolvedValueOnce(success(mockBronzeTableData))
        .mockResolvedValueOnce(success(mockSilverTableData));

      // Get the path
      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      // Make the request without tableName parameter
      const response: SuperTestResponse<ExperimentDataResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Verify the response structure - array with two elements
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);

      // Check first table
      expect(response.body[0]).toMatchObject({
        name: mockTablesResponse.tables[0].name,
        catalog_name: mockTablesResponse.tables[0].catalog_name,
        schema_name: mockTablesResponse.tables[0].schema_name,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      // Check second table
      expect(response.body[1]).toMatchObject({
        name: mockTablesResponse.tables[1].name,
        catalog_name: mockTablesResponse.tables[1].catalog_name,
        schema_name: mockTablesResponse.tables[1].schema_name,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      });

      // Check data exists for each table
      expect(response.body[0].data).toBeDefined();
      expect(response.body[1].data).toBeDefined();

      // Verify the DatabricksAdapter was called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.listTables).toHaveBeenCalledWith(experiment.name, experiment.id);

      // Verify SQL queries were executed for each table
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        1,
        `exp_test_experiment_for_tables_${experiment.id}`,
        "SELECT * FROM bronze_data LIMIT 5",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_test_experiment_for_tables_${experiment.id}`,
        "SELECT * FROM silver_data LIMIT 5",
      );
    });

    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = faker.string.uuid();

      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 403 if user doesn't have access to the experiment", async () => {
      // Create a different user
      const otherUserId = await testApp.createTestUser({});

      // Create an experiment owned by the other user
      const { experiment } = await testApp.createExperiment({
        name: "Restricted Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withAuth(testUserId) // Use the first user who doesn't have access
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("access");
        });
    });

    it("should return 400 for invalid experiment UUID", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Data",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle Databricks service errors appropriately", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment with Databricks Error",
        userId: testUserId,
      });

      // Mock the DatabricksAdapter to return an error
      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(
        failure(AppError.internal("Error retrieving data from Databricks")),
      );

      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Failed to list tables");
        });
    });

    it("should handle SQL execution errors when fetching table data", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment SQL Error",
        userId: testUserId,
      });

      // Mock listTables to return the table exists
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "nonexistent_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock the DatabricksAdapter to fail on SQL execution
      vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("SQL execution failed: table not found")),
      );

      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "nonexistent_table" })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Failed to get row count");
        });
    });

    it("should correctly handle pagination parameters", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Pagination",
        userId: testUserId,
      });

      // Define pagination parameters
      const page = 2;
      const pageSize = 10;

      // Mock the DatabricksAdapter methods
      const mockCountData = {
        columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
        rows: [["42"]],
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

      // Mock listTables to validate table exists
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "test_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock getTableMetadata to return column metadata
      const mockMetadataResponse = new Map<string, string>([
        ["column1", "STRING"],
        ["column2", "NUMBER"],
      ]);

      vi.spyOn(databricksAdapter, "getTableMetadata").mockResolvedValue(
        success(mockMetadataResponse),
      );

      vi.spyOn(databricksAdapter, "executeSqlQuery")
        .mockResolvedValueOnce(success(mockCountData)) // First call for count
        .mockResolvedValueOnce(success(mockTableData)); // Second call for actual data

      // Get the path
      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      // Make the request with pagination parameters
      const response: SuperTestResponse<ExperimentDataResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({
          tableName: "test_table",
          page: page,
          pageSize: pageSize,
        })
        .expect(StatusCodes.OK);

      // Verify the response is an array with one element
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);

      // Verify the response includes correct pagination information
      expect(response.body[0].page).toBe(page);
      expect(response.body[0].pageSize).toBe(pageSize);
      expect(response.body[0].totalPages).toBe(5); // Math.ceil(42 / 10)
      expect(response.body[0].totalRows).toBe(42);

      // Verify the DatabricksAdapter was called with correct pagination
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_test_experiment_for_pagination_${experiment.id}`,
        "SELECT * FROM test_table LIMIT 10 OFFSET 10", // page 2 with pageSize 10
      );
    });

    it("should return 404 if specified table does not exist", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment Table Not Found",
        userId: testUserId,
      });

      // Mock listTables to return empty table list
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "existing_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      const path = testApp.resolvePath(contract.experiments.getExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "non_existent_table" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Table 'non_existent_table' not found in this experiment");
        });
    });
  });

  describe("uploadExperimentData", () => {
    // Note: We only test plain .txt files without paths in these controller tests
    // because webkitdirectory behavior cannot be reproduced with supertest.
    // Files with full paths (like "some/dir/Ambyte_1/data.txt") are tested
    // in the use case unit tests where we can control the file structure directly.

    const trimFileName = (fileName: string): string => {
      // If the filename contains a path and matches the Ambyte pattern, trim it
      if (fileName.includes("/")) {
        const pattern = /Ambyte_\d{1,3}\/(?:[1-4]\/)?[^/]+\.txt$/i;
        const ambyteMatch = pattern.exec(fileName);
        return ambyteMatch ? ambyteMatch[0] : fileName;
      }

      // No path in filename - construct one based on the pattern
      const baseFileName = fileName;

      // Check if it matches the timestamp pattern: YYYYMMDD-HHMMSS_.txt
      const timestampPattern = /^\d{8}-\d{6}_\.txt$/;
      if (timestampPattern.test(baseFileName)) {
        // For timestamp files, use unknown_ambyte/unknown_ambit/filename structure
        return `unknown_ambyte/unknown_ambit/${baseFileName}`;
      }

      // For other files, use unknown_ambyte/filename structure
      return `unknown_ambyte/${baseFileName}`;
    };

    // Test mocking helper function to properly prepare the test
    const setupFileUploadTest = async (
      fileName: string,
      description: string,
      willSucceed = true,
    ) => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: `Test Experiment for ${description}`,
        userId: testUserId,
      });

      // Mock successful response from uploadExperimentData
      // Include directoryName in the path structure
      const directoryName = `upload_${new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").split(".")[0]}`;
      const mockUploadResponse = {
        filePath: `/Volumes/${experiment.name}/ambyte/${directoryName}/${fileName}`,
      };

      // Mock successful response from triggerAmbyteProcessingJob
      const mockJobResponse = {
        run_id: faker.number.int(),
        number_in_job: 1,
      };

      // Mock volume operations for preexecute
      const mockVolumeResponse = {
        name: "data-uploads",
        volume_id: faker.string.uuid(),
        catalog_name: "main",
        schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        volume_type: "MANAGED" as const,
        full_name: `main.exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}.data-uploads`,
        created_at: Date.now(),
        created_by: testUserId,
        updated_at: Date.now(),
        updated_by: testUserId,
        metastore_id: faker.string.uuid(),
        owner: testUserId,
      };

      // Set up the proper mock based on whether the test should succeed
      if (willSucceed) {
        // Mock volume exists (so preexecute returns success immediately)
        vi.spyOn(databricksAdapter, "getExperimentVolume").mockResolvedValue(
          success(mockVolumeResponse),
        );
        vi.spyOn(databricksAdapter, "uploadExperimentData").mockResolvedValue(
          success(mockUploadResponse),
        );
        vi.spyOn(databricksAdapter, "triggerAmbyteProcessingJob").mockResolvedValue(
          success(mockJobResponse),
        );
      } else {
        // Mock volume exists but upload fails
        vi.spyOn(databricksAdapter, "getExperimentVolume").mockResolvedValue(
          success(mockVolumeResponse),
        );
        vi.spyOn(databricksAdapter, "uploadExperimentData").mockResolvedValue(
          failure(AppError.internal("Failed to upload file to Databricks")),
        );
      }

      // Get the path
      const path = testApp.resolvePath(contract.experiments.uploadExperimentData.path, {
        id: experiment.id,
      });

      // Create mock file data as Buffer
      const fileBuffer = Buffer.from("mock ambyte data content");

      return { experiment, path, fileBuffer, fileName, mockUploadResponse };
    };

    const getExpectedDirectoryNamePattern = (): RegExp => {
      // Format: upload_YYYYMMDD_HHMMSS
      return /^upload_\d{8}_\d{6}$/;
    };

    it("should upload plain txt file successfully", async () => {
      const fileName = "data.txt";
      const description = "Plain text file";

      const {
        experiment,
        path,
        fileBuffer,
        fileName: testFileName,
        mockUploadResponse,
      } = await setupFileUploadTest(fileName, description);

      const trimmedFileName = trimFileName(testFileName);

      // Make the request
      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, testFileName)
        .expect(StatusCodes.CREATED);

      // Verify response
      const responseBody = response.body as UploadExperimentDataResponse;
      expect(responseBody.files).toHaveLength(1);
      expect(responseBody.files[0].fileName).toBe(trimmedFileName);
      expect(responseBody.files[0].filePath).toBe(mockUploadResponse.filePath);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadExperimentData).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        "ambyte",
        expect.stringMatching(getExpectedDirectoryNamePattern()),
        trimmedFileName,
        fileBuffer,
      );
    });

    it("should return 400 when no files are uploaded", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for No Files",
        userId: testUserId,
      });

      // Mock volume operations for preexecute (volume exists)
      const mockVolumeResponse = {
        name: "data-uploads",
        volume_id: faker.string.uuid(),
        catalog_name: "main",
        schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        volume_type: "MANAGED" as const,
        full_name: `main.exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}.data-uploads`,
        created_at: Date.now(),
        created_by: testUserId,
        updated_at: Date.now(),
        updated_by: testUserId,
        metastore_id: faker.string.uuid(),
        owner: testUserId,
      };

      vi.spyOn(databricksAdapter, "getExperimentVolume").mockResolvedValue(
        success(mockVolumeResponse),
      );

      // Mock the uploadExperimentData method to ensure we can check if it's called
      const uploadExperimentDataSpy = vi.spyOn(databricksAdapter, "uploadExperimentData");

      // Get the path
      const path = testApp.resolvePath(contract.experiments.uploadExperimentData.path, {
        id: experiment.id,
      });

      // Make the request with no file attached (which will result in bad request)
      await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .expect(StatusCodes.BAD_REQUEST);

      // Verify that the upload method was not called
      expect(uploadExperimentDataSpy).not.toHaveBeenCalled();
    });

    it("should return 404 when experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();

      // Get the path
      const path = testApp.resolvePath(contract.experiments.uploadExperimentData.path, {
        id: nonExistentId,
      });

      // Create mock file data
      const fileBuffer = Buffer.from("mock ambyte data content");

      // Make the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, "Ambyte_1/data.txt")
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 403 when user does not have access to the experiment", async () => {
      // Create an experiment owned by another user with private visibility
      const otherUserId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      // Mock the DatabricksAdapter uploadExperimentData method to return forbidden error
      vi.spyOn(databricksAdapter, "uploadExperimentData").mockResolvedValue(
        failure(AppError.forbidden(`User does not have access to experiment`)),
      );

      // Get the path
      const path = testApp.resolvePath(contract.experiments.uploadExperimentData.path, {
        id: experiment.id,
      });

      // Create mock file data
      const fileBuffer = Buffer.from("mock ambyte data content");

      // Make the request
      await testApp
        .post(path)
        .withAuth(testUserId) // Use the test user who doesn't have access
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, "Ambyte_1/data.txt")
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 403 when uploading to an archived experiment", async () => {
      // Create an archived experiment owned by the test user
      const { experiment } = await testApp.createExperiment({
        name: "Archived Upload Experiment",
        userId: testUserId,
        status: "archived",
      });

      // Prepare a mock file buffer
      const fileBuffer = Buffer.from("mock ambyte data content");

      const path = testApp.resolvePath(contract.experiments.uploadExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, "Ambyte_1/data.txt")
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: { message: string } }) => {
          expect(body.message).toBe("Cannot upload data to archived experiments");
        });
    });

    it("should reject invalid file formats", async () => {
      const fileName = "invalid.pdf"; // Not a .txt file
      const description = "Invalid file format";

      const { path, fileBuffer } = await setupFileUploadTest(fileName, description, false);

      // Make the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, fileName)
        .expect(StatusCodes.BAD_REQUEST);

      // No need to verify specific error structure as it will use handleFailure now
    });

    it("should handle failure in databricks file upload", async () => {
      // Set up the test with a valid file name but mock a failure
      const { path, fileBuffer } = await setupFileUploadTest("Ambyte_1", "Upload Error", false);

      // Override the mock to simulate upload failure
      vi.spyOn(databricksAdapter, "uploadExperimentData").mockResolvedValue(
        failure(AppError.internal("Failed to upload file to Databricks")),
      );

      // Make the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, "Ambyte_1/data.txt")
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should handle multiple file uploads", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Multiple Files",
        userId: testUserId,
      });

      // Mock volume operations for preexecute (volume exists)
      const mockVolumeResponse = {
        name: "data-uploads",
        volume_id: faker.string.uuid(),
        catalog_name: "main",
        schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
        volume_type: "MANAGED" as const,
        full_name: `main.exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}.data-uploads`,
        created_at: Date.now(),
        created_by: testUserId,
        updated_at: Date.now(),
        updated_by: testUserId,
        metastore_id: faker.string.uuid(),
        owner: testUserId,
      };

      vi.spyOn(databricksAdapter, "getExperimentVolume").mockResolvedValue(
        success(mockVolumeResponse),
      );

      // Create file paths
      const fileNames = ["data1.txt", "data2.txt"];

      // Mock successful responses from uploadExperimentData
      // Include directoryName in the path structure
      const directoryName = `upload_${new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").split(".")[0]}`;
      const mockUploadResponses = fileNames.map((fileName) => ({
        filePath: `/Volumes/${experiment.name}/ambyte/${directoryName}/${fileName}`,
      }));

      // Mock successful response from triggerAmbyteProcessingJob
      const mockJobResponse = {
        run_id: faker.number.int(),
        number_in_job: 1,
      };

      // Setup upload mocks for each file
      let uploadCallCount = 0;
      vi.spyOn(databricksAdapter, "uploadExperimentData").mockImplementation(() => {
        const response = success(mockUploadResponses[uploadCallCount]);
        uploadCallCount++;
        return Promise.resolve(response);
      });

      vi.spyOn(databricksAdapter, "triggerAmbyteProcessingJob").mockResolvedValue(
        success(mockJobResponse),
      );

      // Get the path
      const path = testApp.resolvePath(contract.experiments.uploadExperimentData.path, {
        id: experiment.id,
      });

      // Create mock file buffers
      const fileBuffers = fileNames.map(() => Buffer.from("mock ambyte data content"));

      // Prepare the request
      const request = testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte");

      // Attach all files
      fileNames.forEach((fileName, index) => {
        request.attach("files", fileBuffers[index], fileName);
      });

      // Make the request
      const response = await request.expect(StatusCodes.CREATED);

      // Verify response
      const responseBody = response.body as UploadExperimentDataResponse;
      expect(responseBody.files).toHaveLength(2);

      const trimmedFileNames = fileNames.map((fileName) => trimFileName(fileName));
      expect(responseBody.files[0].fileName).toBe(trimmedFileNames[0]);
      expect(responseBody.files[0].filePath).toBe(mockUploadResponses[0].filePath);
      expect(responseBody.files[1].fileName).toBe(trimmedFileNames[1]);
      expect(responseBody.files[1].filePath).toBe(mockUploadResponses[1].filePath);

      // Verify the databricksAdapter methods were called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadExperimentData).toHaveBeenCalledTimes(2);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadExperimentData).toHaveBeenNthCalledWith(
        1,
        experiment.id,
        experiment.name,
        "ambyte",
        expect.stringMatching(getExpectedDirectoryNamePattern()), // directoryName follows upload_YYYYMMDD_HHMMSS pattern
        trimmedFileNames[0],
        expect.any(Buffer),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadExperimentData).toHaveBeenNthCalledWith(
        2,
        experiment.id,
        experiment.name,
        "ambyte",
        expect.stringMatching(getExpectedDirectoryNamePattern()), // directoryName follows upload_YYYYMMDD_HHMMSS pattern
        trimmedFileNames[1],
        expect.any(Buffer),
      );
    });
  });

  describe("downloadExperimentData", () => {
    it("should successfully prepare download links for table data", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test_Download_Experiment",
        description: "Test Download Description",
        status: "active",
        visibility: "private",
        userId: testUserId,
      });

      // Mock the external links data that would be returned by Databricks
      const mockDownloadLinksData = {
        external_links: [
          {
            chunk_index: 0,
            row_count: 1000,
            row_offset: 0,
            byte_count: 50000,
            external_link: "https://databricks-presigned-url.com/chunk0",
            expiration: "2024-01-01T15:00:00.000Z",
          },
          {
            chunk_index: 1,
            row_count: 500,
            row_offset: 1000,
            byte_count: 25000,
            external_link: "https://databricks-presigned-url.com/chunk1",
            expiration: "2024-01-01T15:00:00.000Z",
          },
        ],
        totalRows: 1500,
        format: "CSV",
      };

      // Mock listTables to validate table exists
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name.toLowerCase().replace(/ /g, "_")}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      // Setup mocks
      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));
      vi.spyOn(databricksAdapter, "downloadExperimentData").mockResolvedValue(
        success(mockDownloadLinksData),
      );

      // Get the path
      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: experiment.id,
      });

      // Make the request
      const response: SuperTestResponse<DownloadExperimentDataResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "bronze_data" })
        .expect(StatusCodes.OK);

      // Verify the response structure
      expect(response.body).toEqual({
        externalLinks: [
          {
            externalLink: "https://databricks-presigned-url.com/chunk0",
            expiration: "2024-01-01T15:00:00.000Z",
            totalSize: 50000,
            rowCount: 1000,
          },
          {
            externalLink: "https://databricks-presigned-url.com/chunk1",
            expiration: "2024-01-01T15:00:00.000Z",
            totalSize: 25000,
            rowCount: 500,
          },
        ],
      });

      // Verify the DatabricksAdapter was called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.listTables).toHaveBeenCalledWith(experiment.name, experiment.id);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.downloadExperimentData).toHaveBeenCalledWith(
        `exp_test_download_experiment_${experiment.id}`,
        "SELECT * FROM bronze_data",
      );
    });

    it("should return 404 when experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();

      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "bronze_data" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Experiment not found");
        });
    });

    it("should return 403 when user doesn't have access to experiment", async () => {
      // Create another user
      const anotherUserId = await testApp.createTestUser({
        email: "another@example.com",
      });

      // Create an experiment with the first user
      const { experiment } = await testApp.createExperiment({
        name: "Private_Download_Experiment",
        visibility: "private",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: experiment.id,
      });

      // Try to download with the second user (no access)
      await testApp
        .get(path)
        .withAuth(anotherUserId)
        .query({ tableName: "bronze_data" })
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toBe("Access denied to this experiment");
        });
    });

    it("should return 404 when specified table does not exist", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test_Download_Experiment_No_Table",
        userId: testUserId,
      });

      // Mock listTables to return empty tables
      const mockTablesResponse = {
        tables: [],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "nonexistent_table" })
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Table 'nonexistent_table' not found");
        });
    });

    it("should return 401 when not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test_Download_Experiment_Unauth",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withoutAuth()
        .query({ tableName: "bronze_data" })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle Databricks service errors appropriately", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test_Download_Experiment_Error",
        userId: testUserId,
      });

      // Mock the DatabricksAdapter to return an error
      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(
        failure(AppError.internal("Error retrieving tables from Databricks")),
      );

      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: experiment.id,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "bronze_data" })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("Error retrieving tables from Databricks");
        });
    });

    it("should validate required tableName query parameter", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test_Download_Experiment_Validation",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: experiment.id,
      });

      // Make request without tableName query parameter
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should validate experiment ID format", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.downloadExperimentData.path, {
        id: invalidId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ tableName: "bronze_data" })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });
});
