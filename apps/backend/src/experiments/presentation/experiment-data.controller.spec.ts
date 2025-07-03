import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ErrorResponse, ExperimentDataResponse } from "@repo/api";
import { contract } from "@repo/api";

import { DatabricksService } from "../../common/services/databricks/databricks.service";
import { success, failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

describe("ExperimentDataController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let databricksService: DatabricksService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get the DatabricksService instance
    databricksService = testApp.module.get(DatabricksService);

    // Reset any mocks before each test
    jest.restoreAllMocks();
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

      jest
        .spyOn(databricksService, "executeSqlQuery")
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

      // Verify the DatabricksService was called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenNthCalledWith(
        1,
        `exp_${experiment.name}_${experiment.id}`,
        "SELECT COUNT(*) as count FROM test_table",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenNthCalledWith(
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

      // Mock the DatabricksService listTables method
      const mockTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name}_${experiment.id}`,
          },
          {
            name: "silver_data",
            catalog_name: "test_catalog",
            schema_name: `exp_${experiment.name}_${experiment.id}`,
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
      jest.spyOn(databricksService, "listTables").mockResolvedValue(success(mockTablesResponse));

      jest
        .spyOn(databricksService, "executeSqlQuery")
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

      // Verify the DatabricksService was called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.listTables).toHaveBeenCalledWith(experiment.name, experiment.id);

      // Verify SQL queries were executed for each table
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenNthCalledWith(
        1,
        `exp_${experiment.name}_${experiment.id}`,
        "SELECT * FROM bronze_data LIMIT 5",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenNthCalledWith(
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

      // Mock the DatabricksService to return an error
      jest
        .spyOn(databricksService, "listTables")
        .mockResolvedValue(failure(AppError.internal("Error retrieving data from Databricks")));

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

      // Mock the DatabricksService to fail on SQL execution
      jest
        .spyOn(databricksService, "executeSqlQuery")
        .mockResolvedValue(failure(AppError.internal("SQL execution failed: table not found")));

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

      // Mock the DatabricksService methods
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

      jest
        .spyOn(databricksService, "executeSqlQuery")
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

      // Verify the DatabricksService was called with correct pagination
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksService.executeSqlQuery).toHaveBeenNthCalledWith(
        2,
        `exp_${experiment.name}_${experiment.id}`,
        "SELECT * FROM test_table LIMIT 10 OFFSET 10", // page 2 with pageSize 10
      );
    });
  });
});
