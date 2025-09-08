import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type {
  ErrorResponse,
  ExperimentDataResponse,
  UploadExperimentDataResponse,
} from "@repo/api";
import { contract } from "@repo/api";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
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

  describe("uploadExperimentData", () => {
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

      // Mock successful response from uploadFile
      const mockUploadResponse = {
        filePath: `/Volumes/${experiment.name}/ambyte/${fileName}`,
      };

      // Mock successful response from triggerExperimentPipeline
      const mockPipelineResponse = {
        update_id: faker.string.uuid(),
        status: "RUNNING",
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
        vi.spyOn(databricksAdapter, "uploadFile").mockResolvedValue(success(mockUploadResponse));
        vi.spyOn(databricksAdapter, "triggerExperimentPipeline").mockResolvedValue(
          success(mockPipelineResponse),
        );
      } else {
        // Mock volume exists but upload fails
        vi.spyOn(databricksAdapter, "getExperimentVolume").mockResolvedValue(
          success(mockVolumeResponse),
        );
        vi.spyOn(databricksAdapter, "uploadFile").mockResolvedValue(
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

    it.each([
      ["Ambyte_1", "Ambyte folder"],
      ["Ambyte_123", "Ambyte folder with multiple digits"],
      ["1", "Numbered subfolder"],
      ["3", "Numbered subfolder simple"],
      ["20250615-193737_.txt", "Individual data file"],
    ])("should upload ambyte data file successfully: %s (%s)", async (fileName, description) => {
      const {
        experiment,
        path,
        fileBuffer,
        fileName: testFileName,
        mockUploadResponse,
      } = await setupFileUploadTest(fileName, description);

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
      expect(responseBody.files[0].fileName).toBe(testFileName);
      expect(responseBody.files[0].filePath).toBe(mockUploadResponse.filePath);

      // Verify the databricksAdapter methods were called
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadFile).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        "ambyte",
        testFileName,
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

      // Mock the uploadFile method to ensure we can check if it's called
      const uploadFileSpy = vi.spyOn(databricksAdapter, "uploadFile");

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
      expect(uploadFileSpy).not.toHaveBeenCalled();
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
        .attach("files", fileBuffer, "Ambyte_1.zip")
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

      // Mock the DatabricksAdapter uploadFile method to return forbidden error
      vi.spyOn(databricksAdapter, "uploadFile").mockResolvedValue(
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
        .attach("files", fileBuffer, "Ambyte_1.zip")
        .expect(StatusCodes.FORBIDDEN);
    });

    it.each([
      [".DS_Store", "DS_Store file"],
      ["config.txt", "Configuration file"],
      ["ambyte_log.txt", "Log file"],
      ["run.txt", "Run file"],
      ["Ambyte_X/5/file.txt", "Invalid subfolder number"],
      ["random_file.txt", "Completely invalid format"],
      ["20250615-19373_.txt", "Malformed date format"],
      ["Ambyte_12345", "Ambyte folder with too many digits"],
    ])("should reject invalid ambyte data file: %s (%s)", async (fileName, description) => {
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
      vi.spyOn(databricksAdapter, "uploadFile").mockResolvedValue(
        failure(AppError.internal("Failed to upload file to Databricks")),
      );

      // Make the request
      await testApp
        .post(path)
        .withAuth(testUserId)
        .set("Content-Type", "multipart/form-data")
        .field("sourceType", "ambyte")
        .attach("files", fileBuffer, "Ambyte_1")
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
      const fileNames = ["Ambyte_1/1/20250615-193737_.txt", "Ambyte_1/2/20250615-193738_.txt"];

      // Mock successful responses from uploadFile
      const mockUploadResponses = fileNames.map((fileName) => ({
        filePath: `/Volumes/${experiment.name}/ambyte/${fileName}`,
      }));

      // Mock successful response from triggerExperimentPipeline
      const mockPipelineResponse = {
        update_id: faker.string.uuid(),
        status: "RUNNING",
      };

      // Setup upload mocks for each file
      let uploadCallCount = 0;
      vi.spyOn(databricksAdapter, "uploadFile").mockImplementation(() => {
        const response = success(mockUploadResponses[uploadCallCount]);
        uploadCallCount++;
        return Promise.resolve(response);
      });

      vi.spyOn(databricksAdapter, "triggerExperimentPipeline").mockResolvedValue(
        success(mockPipelineResponse),
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

      // In practice, only the filename without the path is captured by multer's originalname
      const expectedFileNames = fileNames.map((path) => path.split("/").pop() ?? path);
      expect(responseBody.files[0].fileName).toBe(expectedFileNames[0]);
      expect(responseBody.files[0].filePath).toBe(mockUploadResponses[0].filePath);
      expect(responseBody.files[1].fileName).toBe(expectedFileNames[1]);
      expect(responseBody.files[1].filePath).toBe(mockUploadResponses[1].filePath);

      // Verify the databricksAdapter methods were called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadFile).toHaveBeenCalledTimes(2);

      // In practice, only the filename without the path is captured by multer's originalname
      const expectedDatabricsUploadNames = fileNames.map((path) => path.split("/").pop() ?? path);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadFile).toHaveBeenNthCalledWith(
        1,
        experiment.id,
        experiment.name,
        "ambyte",
        expectedDatabricsUploadNames[0],
        expect.any(Buffer),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.uploadFile).toHaveBeenNthCalledWith(
        2,
        experiment.id,
        experiment.name,
        "ambyte",
        expectedDatabricsUploadNames[1],
        expect.any(Buffer),
      );
    });
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
      const mockTablesResponse = {
        tables: [
          {
            name: "test_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

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
        schema_name: `exp_${experiment.name}_${experiment.id}`,
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
        `exp_${experiment.name}_${experiment.id}`,
        "SELECT COUNT(*) as count FROM test_table",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_${experiment.name}_${experiment.id}`,
        "SELECT * FROM test_table LIMIT 5 OFFSET 0",
      );
    });

    it("should return tables list with sample data when no table name is specified", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Tables",
        userId: testUserId,
      });

      // Mock the DatabricksAdapter listTables method
      const mockTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
          },
          {
            name: "silver_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
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
        `exp_${experiment.name}_${experiment.id}`,
        "SELECT * FROM bronze_data LIMIT 5",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksAdapter.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_${experiment.name}_${experiment.id}`,
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
      const mockTablesResponse = {
        tables: [
          {
            name: "nonexistent_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
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
      const mockTablesResponse = {
        tables: [
          {
            name: "test_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
          },
        ],
      };

      vi.spyOn(databricksAdapter, "listTables").mockResolvedValue(success(mockTablesResponse));

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
        `exp_${experiment.name}_${experiment.id}`,
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
      const mockTablesResponse = {
        tables: [
          {
            name: "existing_table",
            catalog_name: experiment.name,
            schema_name: `exp_${experiment.name}_${experiment.id}`,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
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
});
