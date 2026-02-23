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
import type { DeltaPort } from "../../../core/ports/delta.port";
import { DELTA_PORT } from "../../../core/ports/delta.port";
import { GetExperimentTablesUseCase } from "./get-experiment-tables";

describe("GetExperimentTablesUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentTablesUseCase;
  let deltaPort: DeltaPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentTablesUseCase);
    deltaPort = testApp.module.get(DELTA_PORT);

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

      // Mock Delta Sharing responses
      vi.spyOn(deltaPort, "listTables").mockResolvedValue(
        success({
          tables: [
            {
              name: ExperimentTableName.RAW_DATA,
              catalog_name: "",
              schema_name: "default",
              table_type: "TABLE",
              created_at: Date.now(),
            },
            {
              name: ExperimentTableName.DEVICE,
              catalog_name: "",
              schema_name: "default",
              table_type: "TABLE",
              created_at: Date.now(),
            },
            {
              name: "some_macro",
              catalog_name: "",
              schema_name: "default",
              table_type: "TABLE",
              created_at: Date.now(),
            },
          ],
        }),
      );

      vi.spyOn(deltaPort, "getTableRowCount")
        .mockResolvedValueOnce(success(100))
        .mockResolvedValueOnce(success(50))
        .mockResolvedValueOnce(success(25));

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

      // Verify Delta port calls
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deltaPort.listTables).toHaveBeenCalledWith(experiment.name, experiment.id);
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

      vi.spyOn(deltaPort, "listTables").mockResolvedValue(
        success({
          tables: [
            {
              name: ExperimentTableName.RAW_DATA,
              catalog_name: "",
              schema_name: "default",
              table_type: "TABLE",
              created_at: Date.now(),
            },
          ],
        }),
      );

      vi.spyOn(deltaPort, "getTableRowCount").mockResolvedValue(success(100));

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
    });

    it("should handle listTables failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(deltaPort, "listTables").mockResolvedValue(
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

      vi.spyOn(deltaPort, "listTables").mockResolvedValue(success({ tables: [] }));

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });
});
