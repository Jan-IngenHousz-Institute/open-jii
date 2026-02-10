import { faker } from "@faker-js/faker";
import { expect } from "vitest";

import type { ExperimentTableMetadata } from "../../../common/modules/databricks/databricks.adapter";
import { AppError, success, failure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { ExperimentDto } from "../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { ExperimentDataRepository } from "./experiment-data.repository";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataRepository;
  let databricksPort: DatabricksPort;

  const mockExperiment: ExperimentDto = {
    id: faker.string.uuid(),
    name: "Test Experiment",
    description: "Test description",
    status: "active",
    visibility: "private",
    embargoUntil: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: faker.string.uuid(),
    pipelineId: faker.string.uuid(),
  } as ExperimentDto;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getTableData", () => {
    const experimentId = faker.string.uuid();

    const baseParams = {
      experimentId,
      experiment: mockExperiment,
      tableName: "raw_data",
    };

    it("should successfully get table data with pagination", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 100,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.RAW_DATA_TABLE_NAME} LIMIT 5 OFFSET 0`;
      const mockSchemaData = {
        columns: [
          { name: "id", type_name: "string", type_text: "string", position: 0 },
          { name: "value", type_name: "number", type_text: "int", position: 1 },
        ],
        rows: [
          ["1", "100"],
          ["2", "200"],
        ],
        totalRows: 2,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        page: 1,
        pageSize: 5,
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        name: "raw_data",
        catalog_name: "Test Experiment",
        schema_name: databricksPort.CENTRUM_SCHEMA_NAME,
        page: 1,
        pageSize: 5,
        totalRows: 100,
        totalPages: 20,
      });
      expect(result.value[0].data?.rows).toEqual([
        { id: "1", value: "100" },
        { id: "2", value: "200" },
      ]);

      expect(databricksPort.getExperimentTableMetadata).toHaveBeenCalledWith(experimentId, {
        tableName: "raw_data",
        includeSchemas: true,
      });
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "raw_data",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id", "questions_data"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("should return failure when table not found", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "nonexistent_table",
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error.message).toContain("Table 'nonexistent_table' not found");
        expect(result.error.statusCode).toBe(404);
      }
    });

    it("should return failure when getExperimentTableMetadata fails", async () => {
      const error = AppError.internal("Databricks error");
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(failure(error));

      const result = await repository.getTableData(baseParams);

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error).toBe(error);
      }
    });

    it("should get full table data when specific columns are requested", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 100,
          macroSchema: null,
          questionsSchema: "STRUCT<q1: STRING, q2: INT>",
        },
      ];

      const mockQuery = `SELECT id, value FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.RAW_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [
          { name: "id", type_name: "string", type_text: "string", position: 0 },
          { name: "value", type_name: "number", type_text: "int", position: 1 },
        ],
        rows: [
          ["1", "100"],
          ["2", "200"],
          ["3", "300"],
        ],
        totalRows: 3,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        columns: ["id", "value"],
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        name: "raw_data",
        catalog_name: "Test Experiment",
        schema_name: process.env.DATABRICKS_CENTRUM_SCHEMA_NAME ?? "default",
        page: 1,
        pageSize: 3,
        totalRows: 3,
        totalPages: 1,
      });

      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "raw_data",
        experimentId,
        columns: ["id", "value"],
        variants: [{ columnName: "questions_data", schema: "STRUCT<q1: STRING, q2: INT>" }],
        exceptColumns: ["experiment_id"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: undefined,
        offset: undefined,
      });
    });

    it("should handle macro tables with both schemas", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "macro_123",
          rowCount: 50,
          macroSchema: "STRUCT<output: STRING>",
          questionsSchema: "STRUCT<q1: STRING>",
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.MACRO_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "macro_123",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "macro_123",
        experimentId,
        columns: undefined,
        variants: [
          { columnName: "macro_output", schema: "STRUCT<output: STRING>" },
          { columnName: "questions_data", schema: "STRUCT<q1: STRING>" },
        ],
        exceptColumns: [
          "experiment_id",
          "raw_id",
          "macro_id",
          "macro_name",
          "macro_filename",
          "date",
        ],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("should exclude macro_output when schema is missing for macro tables", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "macro_123",
          rowCount: 50,
          macroSchema: null,
          questionsSchema: "STRUCT<q1: STRING>",
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.MACRO_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "macro_123",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "macro_123",
        experimentId,
        columns: undefined,
        variants: [{ columnName: "questions_data", schema: "STRUCT<q1: STRING>" }],
        exceptColumns: [
          "experiment_id",
          "raw_id",
          "macro_id",
          "macro_name",
          "macro_filename",
          "date",
          "macro_output",
        ],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("should exclude questions_data when schema is missing", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 100,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.RAW_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData(baseParams);

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "raw_data",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id", "questions_data"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("should handle device table type correctly", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "device",
          rowCount: 10,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.DEVICE_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [{ name: "device_id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["device1"]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "device",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "device",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("should return failure when executeSqlQuery fails for full table data", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 100,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const error = AppError.internal("SQL execution failed");

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(`SELECT * FROM table`);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(failure(error));

      const result = await repository.getTableData({
        ...baseParams,
        columns: ["id", "value"],
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe("getTableDataForDownload", () => {
    it("should successfully get download links", async () => {
      const testExperimentId = faker.string.uuid();
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 1000,
          macroSchema: "STRUCT<data: STRING>",
          questionsSchema: null,
        },
      ];

      const mockDownloadData = {
        external_links: [
          {
            chunk_index: 0,
            row_count: 500,
            row_offset: 0,
            byte_count: 1048576,
            external_link: "https://databricks.com/chunk0",
            expiration: "2024-12-31T23:59:59Z",
          },
          {
            chunk_index: 1,
            row_count: 500,
            row_offset: 500,
            byte_count: 1048576,
            external_link: "https://databricks.com/chunk1",
            expiration: "2024-12-31T23:59:59Z",
          },
        ],
        totalRows: 1000,
        format: "CSV" as const,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      const mockQuery = `SELECT * FROM table`;
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockDownloadData));

      const result = await repository.getTableDataForDownload({
        experimentId: testExperimentId,
        tableName: "raw_data",
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.totalRows).toBe(1000);
      expect(result.value.externalLinks).toHaveLength(2);
      expect(result.value.externalLinks[0]).toMatchObject({
        externalLink: "https://databricks.com/chunk0",
        expiration: "2024-12-31T23:59:59Z",
        totalSize: 1048576,
        rowCount: 500,
      });

      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        databricksPort.CENTRUM_SCHEMA_NAME,
        mockQuery,
        "EXTERNAL_LINKS",
        "CSV",
      );
    });

    it("should return failure when table not found", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.getTableDataForDownload({
        experimentId: faker.string.uuid(),
        tableName: "nonexistent",
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error.message).toContain("Table 'nonexistent' not found");
      }
    });

    it("should return failure when metadata fetch fails", async () => {
      const error = AppError.internal("Metadata fetch failed");
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(failure(error));

      const result = await repository.getTableDataForDownload({
        experimentId: faker.string.uuid(),
        tableName: "raw_data",
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error).toBe(error);
      }
    });

    it("should return failure when SQL execution fails", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 1000,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const error = AppError.internal("SQL execution failed");

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(`SELECT * FROM table`);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(failure(error));

      const result = await repository.getTableDataForDownload({
        experimentId: faker.string.uuid(),
        tableName: "raw_data",
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe("edge cases and error paths", () => {
    const experimentId = faker.string.uuid();

    it("should handle exceptColumns being empty", async () => {
      // Test case where all variant columns have schemas, resulting in empty exceptColumns
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_ambyte_data",
          rowCount: 10,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.RAW_AMBYTE_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(mockQuery);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_ambyte_data",
      });

      expect(result.isSuccess()).toBe(true);
      // Verify that exceptColumns is passed (even if it contains only the default experiment_id)
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          exceptColumns: ["experiment_id"],
        }),
      );
    });

    it("should handle SQL execution failure in getTableDataPage", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          tableName: "raw_data",
          rowCount: 100,
          macroSchema: null,
          questionsSchema: null,
        },
      ];

      const error = AppError.internal("SQL execution failed");

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(`SELECT * FROM table`);
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(failure(error));

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        page: 1,
        pageSize: 5,
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error).toBe(error);
      }
    });
  });
});
