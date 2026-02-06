import { faker } from "@faker-js/faker";

import { ExperimentTableName } from "@repo/api";

import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { GetExperimentTablesUseCase } from "./get-experiment-tables";

describe("GetExperimentTablesUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentTablesUseCase;
  let databricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentTablesUseCase);
    databricksPort = testApp.module.get(DATABRICKS_PORT);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should return tables metadata successfully", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Tables",
        userId: testUserId,
      });

      // Mock getExperimentTableMetadata response
      const mockMetadata = [
        { tableName: ExperimentTableName.RAW_DATA, rowCount: 100 },
        { tableName: ExperimentTableName.DEVICE, rowCount: 50 },
        { tableName: "some_macro", rowCount: 25 },
      ];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );

      // Execute the use case
      const result = await useCase.execute(experiment.id, testUserId);

      // Assertions
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(3);

      expect(result.value).toEqual([
        {
          name: ExperimentTableName.RAW_DATA,
          displayName: "Raw Data",
          totalRows: 100,
          defaultSortColumn: "timestamp",
          errorColumn: undefined,
        },
        {
          name: ExperimentTableName.DEVICE,
          displayName: "Device Metadata",
          totalRows: 50,
          defaultSortColumn: "processed_timestamp",
          errorColumn: undefined,
        },
        {
          name: "some_macro",
          displayName: "Processed Data (some_macro)",
          totalRows: 25,
          defaultSortColumn: "timestamp",
          errorColumn: "macro_error",
        },
      ]);

      // Verify Databricks adapter calls
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksPort.getExperimentTableMetadata).toHaveBeenCalledWith(experiment.id, {
        includeSchemas: false,
      });
    });

    it("should return not found error when experiment does not exist", async () => {
      const nonExistentId = faker.string.uuid();

      const result = await useCase.execute(nonExistentId, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain(nonExistentId);
    });

    it("should return forbidden error when user does not have access to private experiment", async () => {
      const otherUserId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Private Experiment",
        userId: otherUserId,
        visibility: "private",
      });

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toContain("do not have access");
    });

    it("should allow access to public experiments without membership", async () => {
      const otherUserId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Public Experiment",
        userId: otherUserId,
        visibility: "public",
      });

      const mockMetadata = [{ tableName: ExperimentTableName.RAW_DATA, rowCount: 100 }];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
    });

    it("should handle getExperimentTableMetadata failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        failure(AppError.internal("Failed to fetch metadata")),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("Failed to retrieve table metadata");
    });

    it("should return empty array when no tables are available", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });
});
