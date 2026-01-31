import { faker } from "@faker-js/faker";

import { ExperimentTableName } from "@repo/api";

import type { ListTablesResponse } from "../../../../common/modules/databricks/services/tables/tables.types";
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
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
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

      const schemaName = experiment.schemaName ?? `exp_test_experiment_for_tables_${experiment.id}`;

      // Mock listTables response
      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
          },
          {
            name: ExperimentTableName.DEVICE,
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Device Metadata" },
          },
          {
            name: "annotations",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" },
          },
        ],
      };

      // databricksPort already declared and initialized in beforeEach
      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock count queries for each table (excluding annotations)
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(
          success({
            columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
            rows: [["100"]],
            totalRows: 1,
            truncated: false,
          }),
        ) // measurements count
        .mockResolvedValueOnce(
          success({
            columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
            rows: [["50"]],
            totalRows: 1,
            truncated: false,
          }),
        ); // device count

      // Execute the use case
      const result = await useCase.execute(experiment.id, testUserId);

      // Assertions
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(2); // Should exclude annotations table

      expect(result.value).toEqual([
        {
          name: "measurements",
          displayName: "Measurements",
          totalRows: 100,
        },
        {
          name: ExperimentTableName.DEVICE,
          displayName: "Device Metadata",
          totalRows: 50,
        },
      ]);

      // Verify Databricks adapter calls
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksPort.listTables).toHaveBeenCalledWith(schemaName);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        schemaName,
        "SELECT COUNT(*) as count FROM measurements",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        schemaName,
        "SELECT COUNT(*) as count FROM device",
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(databricksPort.executeSqlQuery).not.toHaveBeenCalledWith(
        schemaName,
        "SELECT COUNT(*) as count FROM annotations",
      );
    });

    it("should filter out upstream tables (downstream !== 'false')", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
          },
          {
            name: ExperimentTableName.RAW_DATA,
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "true", display_name: "Raw Data" }, // upstream table
          },
        ],
      };

      // databricksPort already declared and initialized in beforeEach
      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(
        success({
          columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
          rows: [["100"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.name).toBe("measurements");
    });

    it("should use table name as display name when display_name is not provided", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false" }, // No display_name
          },
        ],
      };

      // databricksPort already declared and initialized in beforeEach
      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(
        success({
          columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
          rows: [["100"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value[0]?.displayName).toBe("measurements");
    });

    it("should handle count query failures gracefully and default to 0", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
          },
        ],
      };

      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock count query to fail
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(
        failure(AppError.internal("Count query failed")),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value[0]?.totalRows).toBe(0);
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

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
          },
        ],
      };

      // databricksPort already declared and initialized in beforeEach
      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(
        success({
          columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
          rows: [["100"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
    });

    it("should handle Databricks adapter listTables failure", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(databricksPort, "listTables").mockResolvedValue(
        failure(AppError.internal("Failed to connect to Databricks")),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("Failed to list tables");
    });

    it("should return empty array when no final tables are available", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const mockTablesResponse: ListTablesResponse = {
        tables: [], // No tables
      };

      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle count query failure and log warning", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
          },
        ],
      };

      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock count query to fail
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValueOnce(
        failure(AppError.internal("SQL execution failed")),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual({
        name: "measurements",
        displayName: "Measurements",
        totalRows: 0, // Should default to 0 on failure
        columns: undefined, // No columns provided in mock
      });
    });

    it("should include column metadata when available", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
            columns: [
              {
                name: "id",
                type_text: "BIGINT",
                type_name: "LONG",
                position: 0,
                nullable: false,
                comment: "Primary key",
                type_json: '{"name":"long","type":"long"}',
                type_precision: 0,
                type_scale: 0,
                partition_index: undefined,
              },
              {
                name: "value",
                type_text: "DOUBLE",
                type_name: "DOUBLE",
                position: 1,
                nullable: true,
                comment: "Measurement value",
                type_json: '{"name":"double","type":"double"}',
                type_precision: 0,
                type_scale: 0,
                partition_index: undefined,
              },
            ],
          },
        ],
      };

      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
          rows: [["100"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual({
        name: "measurements",
        displayName: "Measurements",
        totalRows: 100,
        columns: [
          {
            name: "id",
            type_text: "BIGINT",
            type_name: "LONG",
            position: 0,
            nullable: false,
            comment: "Primary key",
            type_json: '{"name":"long","type":"long"}',
            type_precision: 0,
            type_scale: 0,
            partition_index: undefined,
          },
          {
            name: "value",
            type_text: "DOUBLE",
            type_name: "DOUBLE",
            position: 1,
            nullable: true,
            comment: "Measurement value",
            type_json: '{"name":"double","type":"double"}',
            type_precision: 0,
            type_scale: 0,
            partition_index: undefined,
          },
        ],
      });
    });

    it("should reorder device table to be last", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
      const schemaName = `exp_${cleanName}_${experiment.id}`;

      const mockTablesResponse: ListTablesResponse = {
        tables: [
          {
            name: ExperimentTableName.DEVICE,
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Device Metadata" },
          },
          {
            name: "measurements",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Measurements" },
          },
          {
            name: "events",
            catalog_name: experiment.name,
            schema_name: schemaName,
            table_type: "MANAGED" as const,
            created_at: Date.now(),
            properties: { downstream: "false", display_name: "Events" },
          },
        ],
      };

      vi.spyOn(databricksPort, "listTables").mockResolvedValue(success(mockTablesResponse));

      // Mock count queries for all tables
      vi.spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(
          success({
            columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
            rows: [["50"]],
            totalRows: 1,
            truncated: false,
          }),
        ) // device count
        .mockResolvedValueOnce(
          success({
            columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
            rows: [["100"]],
            totalRows: 1,
            truncated: false,
          }),
        ) // measurements count
        .mockResolvedValueOnce(
          success({
            columns: [{ name: "count", type_name: "LONG", type_text: "LONG" }],
            rows: [["75"]],
            totalRows: 1,
            truncated: false,
          }),
        ); // events count

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(3);

      // Device should be last
      expect(result.value[0]?.name).toBe("measurements");
      expect(result.value[1]?.name).toBe("events");
      expect(result.value[2]?.name).toBe(ExperimentTableName.DEVICE);
    });

    it("should handle experiment without schemaName", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment",
        userId: testUserId,
      });

      const experimentRepository = testApp.module.get(ExperimentRepository);

      vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
        success({
          experiment: { ...experiment, schemaName: null },
          hasAccess: true,
          isAdmin: false,
          hasArchiveAccess: false,
        }),
      );

      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe("Experiment schema not provisioned");
    });
  });
});
