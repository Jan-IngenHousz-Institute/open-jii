import { faker } from "@faker-js/faker";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { expect } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import {
  AppError,
  success,
  failure,
  assertSuccess,
  assertFailure,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";
import type { ExperimentDto } from "../models/experiment.model";
import { CACHE_PORT } from "../ports/cache.port";
import type { CachePort } from "../ports/cache.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";
import { ExperimentDataRepository } from "./experiment-data.repository";

/* eslint-disable @typescript-eslint/unbound-method */

type ExperimentQuery = Parameters<DatabricksPort["buildExperimentQuery"]>[0];

describe("ExperimentDataRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataRepository;
  let databricksPort: DatabricksPort;

  const VIEW_COLUMNS = ["id", "timestamp", "device"];

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
  } as ExperimentDto;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    // Table metadata is cached per experiment; the fixtures reuse it.
    await testApp.module.get<Cache>(CACHE_MANAGER).clear();
    vi.spyOn(databricksPort, "getExperimentTableColumns").mockResolvedValue(success(VIEW_COLUMNS));
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
          identifier: "raw_data",
          tableType: "static",
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
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
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
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
        includeSchemas: true,
      });
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "raw_data",
        tableType: "static",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id", "questions_data", "custom_metadata"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("logs one read summary with the warehouse phases split out", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
      const countData = {
        columns: [{ name: "total", type_name: "long", type_text: "BIGINT", position: 0 }],
        rows: [["7"]],
        totalRows: 1,
        truncated: false,
      };
      const pageData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"], ["2"]],
        totalRows: 2,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        success("SELECT id FROM raw_data"),
      );
      vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation((_schema, sql) =>
        Promise.resolve(success(sql.startsWith("SELECT COUNT") ? countData : pageData)),
      );
      const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

      const result = await repository.getTableData({
        ...baseParams,
        columns: ["id"],
        filters: [{ column: "id", operator: "equals", value: "1" }],
        page: 2,
        pageSize: 2,
      });

      assertSuccess(result);
      expect(result.value[0]).toMatchObject({ page: 2, pageSize: 2, totalRows: 7, totalPages: 4 });
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Experiment data read",
          experimentId,
          tableName: "raw_data",
          mode: "filtered-page",
          metadataMs: expect.any(Number) as number,
          countMs: expect.any(Number) as number,
          dataMs: expect.any(Number) as number,
          totalMs: expect.any(Number) as number,
          rows: 2,
          totalRows: 2,
          truncated: false,
        }),
      );
      logSpy.mockRestore();
    });

    it("issues the filtered COUNT and the page as concurrent statements", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
      const countData = {
        columns: [{ name: "total", type_name: "long", type_text: "BIGINT", position: 0 }],
        rows: [["12"]],
        totalRows: 1,
        truncated: false,
      };
      const pageData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"], ["2"], ["3"]],
        totalRows: 3,
        truncated: false,
      };
      const settle: (() => void)[] = [];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        success("SELECT id FROM raw_data"),
      );
      const executeSpy = vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation(
        (_schema, sql) =>
          new Promise((resolve) => {
            settle.push(() =>
              resolve(success(sql.startsWith("SELECT COUNT") ? countData : pageData)),
            );
          }),
      );
      executeSpy.mockClear();

      const pending = repository.getTableData({
        ...baseParams,
        columns: ["id"],
        filters: [{ column: "id", operator: "equals", value: "1" }],
        page: 3,
        pageSize: 3,
      });

      // Both statements are in flight before either one has answered.
      await vi.waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(2));
      settle.forEach((resolve) => resolve());

      const result = await pending;
      assertSuccess(result);
      expect(result.value[0]).toMatchObject({ page: 3, pageSize: 3, totalRows: 12, totalPages: 4 });
      expect(result.value[0].data?.rows).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    });

    it("runs an identical read once while it is in flight, and again once it finished", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
      const rows = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };
      const settle: (() => void)[] = [];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        success("SELECT id FROM raw_data"),
      );
      const executeSpy = vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation(
        () =>
          new Promise((resolve) => {
            settle.push(() => resolve(success(rows)));
          }),
      );
      executeSpy.mockClear();

      const chartRead = { ...baseParams, columns: ["id"] };
      const first = repository.getTableData(chartRead);
      const second = repository.getTableData(chartRead);

      await vi.waitFor(() => expect(settle).toHaveLength(1));
      settle.forEach((resolve) => resolve());

      const [firstResult, secondResult] = await Promise.all([first, second]);
      assertSuccess(firstResult);
      assertSuccess(secondResult);
      expect(secondResult.value[0].data?.rows).toEqual([{ id: "1" }]);
      expect(executeSpy).toHaveBeenCalledTimes(1);

      const third = repository.getTableData(chartRead);
      await vi.waitFor(() => expect(settle).toHaveLength(2));
      settle.slice(1).forEach((resolve) => resolve());
      assertSuccess(await third);
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });

    it("serves the table metadata from the cache on the next read", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
      const pageData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };
      const metadataSpy = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(success(mockMetadata));
      metadataSpy.mockClear();
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(pageData));

      const first = await repository.getTableData({ ...baseParams, page: 1, pageSize: 5 });
      const second = await repository.getTableData({ ...baseParams, page: 2, pageSize: 5 });

      assertSuccess(first);
      assertSuccess(second);
      expect(second.value[0]).toMatchObject({ page: 2, totalRows: 100 });
      expect(metadataSpy).toHaveBeenCalledTimes(1);
    });

    it("reads a table from the snapshot the tables listing served", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: "2026-09-22T10:05:00.000Z",
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
        {
          identifier: "macro_123",
          tableType: "macro",
          displayName: null,
          rowCount: 7,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
      const pageData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };
      const metadataSpy = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(success(mockMetadata));
      metadataSpy.mockClear();
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(pageData));

      const listing = await repository.tablesMetadata(experimentId);
      const page = await repository.getTableData({ ...baseParams, page: 1, pageSize: 5 });

      assertSuccess(listing);
      assertSuccess(page);
      expect(listing.value).toEqual(mockMetadata);
      expect(page.value[0]).toMatchObject({ totalRows: 100, totalPages: 20 });
      expect(metadataSpy).toHaveBeenCalledTimes(1);
    });

    it("does not cache a failed metadata lookup", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
      const pageData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };
      const metadataSpy = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValueOnce(failure(AppError.internal("warehouse unavailable")))
        .mockResolvedValueOnce(success(mockMetadata));
      metadataSpy.mockClear();
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(pageData));

      const first = await repository.getTableData({ ...baseParams, page: 1, pageSize: 5 });
      const second = await repository.getTableData({ ...baseParams, page: 1, pageSize: 5 });

      assertFailure(first);
      expect(first.error.message).toContain("warehouse unavailable");
      assertSuccess(second);
      expect(metadataSpy).toHaveBeenCalledTimes(2);
    });

    it("tags contributor id filters with the pseudonym salt when anonymizing", async () => {
      const pseudo = new ContributorAnonymizerService().pseudonymFor(mockExperiment.id, "u1");

      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          rowCount: 10,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({ columns: [], rows: [], totalRows: 0, truncated: false }),
      );

      const result = await repository.getTableData({
        ...baseParams,
        experiment: { ...mockExperiment, anonymizeContributors: true },
        filters: [
          { column: "contributor.id", operator: "in", value: [pseudo] },
          { column: "site", operator: "equals", value: "field-a" },
        ],
        limit: 50,
      });

      assertSuccess(result);

      // No extra lookup query: the pseudonym is recomputed in SQL, not reversed.
      expect(databricksPort.executeSqlQuery).toHaveBeenCalledTimes(1);
      // The contributor filter carries the salt; the plain column filter does not.
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column: "contributor.id",
              operator: "in",
              value: [pseudo],
              contributorPseudonymSalt: mockExperiment.id,
            },
            { column: "site", operator: "equals", value: "field-a" },
          ],
        }),
      );
    });

    it("leaves filters untouched when the experiment does not anonymize", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          rowCount: 10,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({ columns: [], rows: [], totalRows: 0, truncated: false }),
      );

      await repository.getTableData({
        ...baseParams,
        experiment: { ...mockExperiment, anonymizeContributors: false },
        filters: [{ column: "contributor.id", operator: "in", value: ["u1"] }],
        limit: 50,
      });

      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ column: "contributor.id", operator: "in", value: ["u1"] }],
        }),
      );
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
          identifier: "raw_data",
          tableType: "static",
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: "STRUCT<q1: STRING, q2: INT>",
          customMetadataSchema: null,
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
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
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
        tableType: "static",
        experimentId,
        columns: ["id", "value"],
        variants: [
          { columnName: "questions_data", schema: "STRUCT<q1: STRING, q2: INT>", suffix: "answer" },
        ],
        reservedColumns: VIEW_COLUMNS,
        exceptColumns: ["experiment_id", "custom_metadata"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: undefined,
        offset: undefined,
      });
    });

    it("should handle macro tables with both schemas", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "macro_123",
          tableType: "macro",
          rowCount: 50,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: "STRUCT<output: STRING>",
          questionsSchema: "STRUCT<q1: STRING>",
          customMetadataSchema: null,
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
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "macro_123",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "macro_123",
        tableType: "macro",
        experimentId,
        columns: undefined,
        variants: [
          { columnName: "macro_output", schema: "STRUCT<output: STRING>", suffix: "output" },
          { columnName: "questions_data", schema: "STRUCT<q1: STRING>", suffix: "answer" },
        ],
        reservedColumns: VIEW_COLUMNS,
        exceptColumns: [
          "experiment_id",
          "raw_id",
          "macro_id",
          "macro_name",
          "macro_filename",
          "date",
          "custom_metadata",
        ],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("reads a payload field named like a view column under a suffixed key and tags it", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "macro_123",
            tableType: "macro",
            rowCount: 50,
            latestRowAt: null,
            schemaRevision: null,
            macroSchema: "OBJECT<device: STRING, phi2: DOUBLE>",
            questionsSchema: null,
            customMetadataSchema: null,
          },
        ]),
      );
      vi.spyOn(databricksPort, "getExperimentTableColumns").mockResolvedValue(
        success(["id", "device", "macro_id", "macro_output", "questions_data"]),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [
            { name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 },
            {
              name: "device",
              type_name: "STRUCT",
              type_text: "STRUCT<serial: STRING>",
              position: 1,
            },
            { name: "device_output", type_name: "STRING", type_text: "STRING", position: 2 },
            { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE", position: 3 },
          ],
          rows: [["1", '{"serial":"28:37"}', "AmbitV003", "0.5"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getTableData({ ...baseParams, tableName: "macro_123" });

      assertSuccess(result);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variants: [
            {
              columnName: "macro_output",
              schema: "OBJECT<device: STRING, phi2: DOUBLE>",
              suffix: "output",
            },
          ],
          reservedColumns: ["id", "device"],
        }),
      );
      expect(result.value[0].data?.columns).toEqual([
        { name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 },
        { name: "device", type_name: "STRUCT", type_text: "STRUCT<serial: STRING>", position: 1 },
        {
          name: "device_output",
          type_name: "STRING",
          type_text: "STRING",
          position: 2,
          renamedFrom: { name: "device", source: "macro_output" },
        },
        { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE", position: 3 },
      ]);
      expect(result.value[0].data?.rows[0]).toMatchObject({
        device: '{"serial":"28:37"}',
        device_output: "AmbitV003",
      });
    });

    it("looks a view's columns up once for many reads, and not for a table without payloads", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "macro_123",
            tableType: "macro",
            rowCount: 50,
            latestRowAt: null,
            schemaRevision: null,
            macroSchema: "OBJECT<phi2: DOUBLE>",
            questionsSchema: null,
            customMetadataSchema: null,
          },
          {
            identifier: "device",
            tableType: "static",
            rowCount: 5,
            latestRowAt: null,
            schemaRevision: null,
            macroSchema: null,
            questionsSchema: null,
            customMetadataSchema: null,
          },
        ]),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({ columns: [], rows: [], totalRows: 0, truncated: false }),
      );

      await repository.getTableData({ ...baseParams, tableName: "macro_123" });
      await repository.getTableData({
        ...baseParams,
        tableName: "macro_123",
        page: 2,
        pageSize: 5,
      });
      await repository.getTableData({ ...baseParams, tableName: "device" });

      expect(databricksPort.getExperimentTableColumns).toHaveBeenCalledTimes(1);
      expect(databricksPort.getExperimentTableColumns).toHaveBeenCalledWith("macro", "macro_123");
    });

    it("should exclude macro_output when schema is missing for macro tables", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "macro_123",
          tableType: "macro",
          rowCount: 50,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: "STRUCT<q1: STRING>",
          customMetadataSchema: null,
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
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "macro_123",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "macro_123",
        tableType: "macro",
        experimentId,
        columns: undefined,
        variants: [
          { columnName: "questions_data", schema: "STRUCT<q1: STRING>", suffix: "answer" },
        ],
        reservedColumns: VIEW_COLUMNS,
        exceptColumns: [
          "experiment_id",
          "raw_id",
          "macro_id",
          "macro_name",
          "macro_filename",
          "date",
          "macro_output",
          "custom_metadata",
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
          identifier: "raw_data",
          tableType: "static",
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
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
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData(baseParams);

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "raw_data",
        tableType: "static",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id", "questions_data", "custom_metadata"],
        orderBy: undefined,
        orderDirection: "ASC",
        limit: 5,
        offset: 0,
      });
    });

    it("should handle device table type correctly", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "device",
          tableType: "static",
          rowCount: 10,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
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
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        ...baseParams,
        tableName: "device",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith({
        tableName: "device",
        tableType: "static",
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
          identifier: "raw_data",
          tableType: "static",
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];

      const error = AppError.internal("SQL execution failed");

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        success(`SELECT * FROM table`),
      );
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

  describe("table shape", () => {
    const readParams = { experimentId: faker.string.uuid(), experiment: mockExperiment };
    const macroTable: ExperimentTableMetadata = {
      identifier: "macro_123",
      tableType: "macro",
      rowCount: 50,
      latestRowAt: null,
      schemaRevision: null,
      macroSchema: "OBJECT<phi2: DOUBLE>",
      questionsSchema: null,
      customMetadataSchema: null,
    };
    const emptyData = { columns: [], rows: [], totalRows: 0, truncated: false };

    it("runs an aggregation over the table with its payload flattened", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([macroTable]),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptyData));
      const aggregation = { groupBy: [{ column: "phi2" }], functions: [] };

      const result = await repository.getTableData({
        experimentId: faker.string.uuid(),
        experiment: mockExperiment,
        tableName: "macro_123",
        aggregation,
      });

      assertSuccess(result);
      expect(result.value[0].totalPages).toBe(1);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregation,
          variants: [
            { columnName: "macro_output", schema: "OBJECT<phi2: DOUBLE>", suffix: "output" },
          ],
          reservedColumns: VIEW_COLUMNS,
        }),
      );
    });

    it("passes on a query-builder failure for an aggregation and for a chart read", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([macroTable]),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        failure(AppError.badRequest("bad column", "INVALID_QUERY_INPUT")),
      );
      const params = {
        experimentId: faker.string.uuid(),
        experiment: mockExperiment,
        tableName: "macro_123",
      };

      const aggregated = await repository.getTableData({
        ...params,
        aggregation: { groupBy: [{ column: "phi2" }], functions: [] },
      });
      const charted = await repository.getTableData({ ...params, columns: ["phi2"] });

      assertFailure(aggregated);
      assertFailure(charted);
      expect(charted.error.code).toBe("INVALID_QUERY_INPUT");
    });

    it("flattens an upload table's rows and its custom metadata, each with its suffix", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "upload_1",
            tableType: "upload",
            rowCount: 5,
            latestRowAt: null,
            schemaRevision: null,
            customMetadataSchema: "OBJECT<plot: STRING>",
            uploadSchema: "OBJECT<id: STRING, leaf: DOUBLE>",
          },
        ]),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptyData));

      await repository.getTableData({ ...readParams, tableName: "upload_1" });

      expect(databricksPort.getExperimentTableColumns).toHaveBeenCalledWith("upload", "upload_1");
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variants: [
            { columnName: "custom_metadata", schema: "OBJECT<plot: STRING>", suffix: "metadata" },
            {
              columnName: "uploaded_data",
              schema: "OBJECT<id: STRING, leaf: DOUBLE>",
              suffix: "upload",
            },
          ],
        }),
      );
    });

    it("hides an upload table's payload when it has no schema, and looks up no columns", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "upload_1",
            tableType: "upload",
            rowCount: 5,
            latestRowAt: null,
            schemaRevision: null,
          },
        ]),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(emptyData));

      await repository.getTableData({ ...readParams, tableName: "upload_1" });

      const [query] = vi.mocked(databricksPort.buildExperimentQuery).mock.calls[0];
      expect(databricksPort.getExperimentTableColumns).not.toHaveBeenCalled();
      expect(query.variants).toBeUndefined();
      expect(query.exceptColumns).toContain("uploaded_data");
      expect(query.exceptColumns).toContain("custom_metadata");
    });

    it("fails a read when the view's columns cannot be looked up", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([macroTable]),
      );
      vi.spyOn(databricksPort, "getExperimentTableColumns").mockResolvedValue(
        failure(AppError.internal("warehouse unavailable")),
      );

      const result = await repository.getTableData({ ...readParams, tableName: "macro_123" });

      assertFailure(result);
      expect(result.error.message).toBe("warehouse unavailable");
    });
  });

  describe("late payload pages", () => {
    const largeMacroTable: ExperimentTableMetadata = {
      identifier: "macro_123",
      tableType: "macro",
      displayName: null,
      rowCount: 500_000,
      latestRowAt: null,
      schemaRevision: null,
      macroSchema: "OBJECT<phi2: DOUBLE>",
      questionsSchema: null,
      customMetadataSchema: null,
    };
    const idColumn = { name: "id", type_name: "INT", type_text: "INT", position: 0 };
    const phi2Column = { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE", position: 1 };
    const table = (
      columns: { name: string; type_name: string; type_text: string; position: number }[],
      rows: (string | null)[][],
    ) => ({ columns, rows, totalRows: rows.length, truncated: false });

    /**
     * Answers the id pick with `ids`, the lookup by id with `rows`, a COUNT with 9 and anything
     * else with one full row, failing the statements `failOn` picks; returns every statement in
     * the order it started.
     */
    const answer = (
      ids: string[],
      rows: (string | null)[][],
      failOn: (sql: string) => boolean = () => false,
    ) => {
      const statements: string[] = [];
      vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation((_schema, sql) => {
        statements.push(sql);
        if (failOn(sql)) {
          return Promise.resolve(failure(AppError.internal("warehouse unavailable")));
        }
        if (sql.startsWith("SELECT COUNT")) {
          return Promise.resolve(success(table([idColumn], [["9"]])));
        }
        if (sql.includes("`id` IN (")) {
          return Promise.resolve(success(table([idColumn, phi2Column], rows)));
        }
        if (sql.startsWith("SELECT `id`\n")) {
          return Promise.resolve(
            success(
              table(
                [idColumn],
                ids.map((id) => [id]),
              ),
            ),
          );
        }
        return Promise.resolve(success(table([idColumn, phi2Column], [["1", "0.5"]])));
      });
      return statements;
    };

    const readPage = (metadata: ExperimentTableMetadata, extra: object = {}) => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([metadata]));
      return repository.getTableData({
        ...{ experimentId: faker.string.uuid(), experiment: mockExperiment },
        tableName: metadata.identifier,
        page: 1,
        pageSize: 3,
        orderBy: "timestamp",
        orderDirection: "DESC",
        ...extra,
      });
    };

    it("picks a large table's page by id, then reads only those rows, in the picked order", async () => {
      const statements = answer(
        ["3", "1", "2"],
        [
          ["1", "0.1"],
          ["2", "0.2"],
          ["3", "0.3"],
        ],
      );
      const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

      const result = await readPage(largeMacroTable);

      assertSuccess(result);
      expect(statements).toHaveLength(2);
      expect(statements[0]).toMatch(/^SELECT `id`\n/);
      expect(statements[0]).toContain("ORDER BY `timestamp` DESC");
      expect(statements[0]).toContain("LIMIT 3");
      expect(statements[1]).toContain("`id` IN ('3', '1', '2')");
      expect(statements[1]).not.toContain("ORDER BY");
      expect(statements[1]).not.toContain("LIMIT");
      expect(result.value[0].data?.rows.map((row) => row.id)).toEqual(["3", "1", "2"]);
      expect(result.value[0].totalRows).toBe(500_000);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "page-late-payload", droppedRows: 0 }),
      );
    });

    it("drops a row outside the page that shares an id, and keeps a page's repeated id", async () => {
      answer(
        ["7", "9", "9"],
        [
          ["7", "a"],
          ["7", "b"],
          ["9", "x"],
          ["9", "y"],
        ],
      );
      const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

      const result = await readPage(largeMacroTable);

      assertSuccess(result);
      expect(result.value[0].data?.rows.map((row) => [row.id, row.phi2])).toEqual([
        ["7", "a"],
        ["9", "x"],
        ["9", "y"],
      ]);
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ droppedRows: 1 }));
    });

    it("reads a page that picks no ids as one statement, so it keeps the table's columns", async () => {
      const statements = answer([], []);

      const result = await readPage(largeMacroTable);

      assertSuccess(result);
      expect(statements).toHaveLength(2);
      expect(statements[1]).not.toContain("IN (");
      expect(statements[1]).toContain("LIMIT 3");
      expect(result.value[0].data?.columns.map((column) => column.name)).toEqual(["id", "phi2"]);
    });

    it("keeps one statement for a small table and for a projection without the row id", async () => {
      const small = answer(["1"], [["1", "0.5"]]);
      await readPage({ ...largeMacroTable, rowCount: 100 });
      expect(small).toHaveLength(1);

      const withoutId = answer(["1"], [["1", "0.5"]]);
      await readPage(largeMacroTable, {
        columns: ["phi2"],
        filters: [{ column: "phi2", operator: "greater_than", value: 0.1 }],
      });
      expect(withoutId.some((sql) => sql.startsWith("SELECT `id`\n"))).toBe(false);
    });

    it("counts a filtered page alongside its id pick, then reads the rows", async () => {
      const statements = answer(["3"], [["3", "0.3"]]);

      const result = await readPage(largeMacroTable, {
        filters: [{ column: "phi2", operator: "greater_than", value: 0.1 }],
      });

      assertSuccess(result);
      expect(statements).toHaveLength(3);
      expect(statements.slice(0, 2).some((sql) => sql.startsWith("SELECT COUNT"))).toBe(true);
      expect(statements.slice(0, 2).some((sql) => sql.startsWith("SELECT `id`\n"))).toBe(true);
      expect(statements[2]).toContain("`id` IN ('3')");
      expect(statements[1]).toContain("> 0.1");
      expect(statements[2]).not.toContain("> 0.1");
      expect(result.value[0].totalRows).toBe(9);
    });

    it.each([
      ["the count", (sql: string) => sql.startsWith("SELECT COUNT")],
      ["the id pick", (sql: string) => sql.startsWith("SELECT `id`\n")],
      ["the lookup by id", (sql: string) => sql.includes("`id` IN (")],
    ])("fails a filtered page when %s fails", async (_step, failOn) => {
      answer(["3"], [["3", "0.3"]], failOn);

      const result = await readPage(largeMacroTable, {
        filters: [{ column: "phi2", operator: "greater_than", value: 0.1 }],
      });

      assertFailure(result);
      expect(result.error.message).toBe("warehouse unavailable");
    });

    it.each([
      ["the id pick", (query: ExperimentQuery) => query.columns?.[0] === "id"],
      ["the lookup by id", (query: ExperimentQuery) => query.filters?.[0]?.operator === "in"],
      ["a small table's page", () => true],
    ])("fails a page when building %s fails", async (step, failOn) => {
      answer(["3"], [["3", "0.3"]]);
      vi.spyOn(databricksPort, "buildExperimentQuery").mockImplementation((query) => {
        if (failOn(query)) {
          return failure(AppError.badRequest("bad column", "INVALID_QUERY_INPUT"));
        }
        return success(query.columns?.[0] === "id" ? "SELECT `id`\nFROM t" : "SELECT * FROM t");
      });
      const table =
        step === "a small table's page" ? { ...largeMacroTable, rowCount: 100 } : largeMacroTable;

      const result = await readPage(table);

      assertFailure(result);
      expect(result.error.code).toBe("INVALID_QUERY_INPUT");
    });

    it("looks an upload row up by an id past 2^53 exactly", async () => {
      const statements = answer(["9223361202566982180"], [["9223361202566982180", "0.5"]]);

      await readPage({
        ...largeMacroTable,
        identifier: "upload_table_1",
        tableType: "upload",
        macroSchema: null,
        uploadSchema: "OBJECT<phi2: DOUBLE>",
      });

      expect(statements[1]).toContain("`id` IN ('9223361202566982180')");
    });
  });

  describe("edge cases and error paths", () => {
    const experimentId = faker.string.uuid();

    it("should handle exceptColumns being empty", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "device",
          tableType: "static",
          displayName: null,
          rowCount: 10,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];

      const mockQuery = `SELECT * FROM ${databricksPort.CENTRUM_SCHEMA_NAME}.${databricksPort.DEVICE_DATA_TABLE_NAME}`;
      const mockSchemaData = {
        columns: [{ name: "id", type_name: "string", type_text: "string", position: 0 }],
        rows: [["1"]],
        totalRows: 1,
        truncated: false,
      };

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success(mockQuery));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(mockSchemaData));

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "device",
      });

      expect(result.isSuccess()).toBe(true);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          tableType: "static",
          exceptColumns: ["experiment_id"],
        }),
      );
    });

    it("should handle SQL execution failure in getTableDataPage", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "raw_data",
          tableType: "static",
          rowCount: 100,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];

      const error = AppError.internal("SQL execution failed");

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        success(`SELECT * FROM table`),
      );
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

    it("should return failure when table config is not found for unknown static table", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "unknown_table",
          tableType: "static",
          rowCount: 10,
          latestRowAt: null,
          schemaRevision: null,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];

      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata),
      );

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "unknown_table",
      });

      expect(result.isSuccess()).toBe(false);
      if (result.isFailure()) {
        expect(result.error.code).toBe("UNKNOWN_TABLE_CONFIG");
      }
    });
  });

  describe("getDistinctColumnValues", () => {
    const experimentId = faker.string.uuid();
    const baseParams = {
      experimentId,
      experiment: mockExperiment,
      tableName: "raw_data",
      column: "site",
      limit: 3,
    };
    const metadata: ExperimentTableMetadata[] = [
      {
        identifier: "raw_data",
        tableType: "static",
        rowCount: 10,
        latestRowAt: null,
        schemaRevision: null,
        macroSchema: null,
        questionsSchema: null,
        customMetadataSchema: null,
      },
    ];

    function mockRows(values: (string | null)[], typeText = "STRING") {
      return {
        columns: [{ name: "site", type_name: typeText, type_text: typeText, position: 0 }],
        rows: values.map((v) => [v]),
        totalRows: values.length,
        truncated: false,
      };
    }

    it("strips nulls/blanks and preserves string-column values verbatim", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(mockRows(["alpha", null, "", "007"])),
      );

      const result = await repository.getDistinctColumnValues({ ...baseParams, limit: 10 });

      assertSuccess(result);
      expect(result.value).toEqual({ values: ["alpha", "007"], truncated: false });
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: "raw_data",
          tableType: "static",
          experimentId,
          columns: ["site"],
          distinct: true,
          orderBy: "site",
          orderDirection: "ASC",
          limit: 11,
        }),
      );
    });

    it("coerces values to numbers only for a numeric column", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(mockRows(["42", "3.5", null], "DOUBLE")),
      );

      const result = await repository.getDistinctColumnValues(baseParams);

      assertSuccess(result);
      expect(result.value).toEqual({ values: [42, 3.5], truncated: false });
    });

    it("flags truncation and trims to the requested limit", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(mockRows(["a", "b", "c", "d"])),
      );

      const result = await repository.getDistinctColumnValues(baseParams);

      assertSuccess(result);
      expect(result.value).toEqual({ values: ["a", "b", "c"], truncated: true });
    });

    it("pseudonymises contributor names when the experiment anonymizes contributors", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(
          mockRows(
            [JSON.stringify({ id: "u1", name: "Alice", avatar: "https://a" })],
            WellKnownColumnTypes.CONTRIBUTOR,
          ),
        ),
      );

      const result = await repository.getDistinctColumnValues({
        ...baseParams,
        experiment: { ...mockExperiment, anonymizeContributors: true },
      });

      assertSuccess(result);
      const [value] = result.value.values;
      const parsed = JSON.parse(String(value)) as { id: string; name: string; avatar: null };
      expect(parsed.id).toMatch(/^Contributor-[0-9A-F]{6}$/);
      expect(parsed.name).toBe(parsed.id);
      expect(parsed.avatar).toBeNull();
    });

    it("propagates a metadata lookup failure", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        failure(AppError.internal("boom")),
      );

      const result = await repository.getDistinctColumnValues(baseParams);
      assertFailure(result);
    });

    it("returns notFound when the table is absent from metadata", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.getDistinctColumnValues(baseParams);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("propagates a query-builder failure", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        failure(AppError.badRequest("bad query")),
      );

      const result = await repository.getDistinctColumnValues(baseParams);
      assertFailure(result);
    });

    it("propagates an executeSqlQuery failure", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("UNRESOLVED_COLUMN")),
      );

      const result = await repository.getDistinctColumnValues(baseParams);
      assertFailure(result);
    });
  });

  describe("getTableColumns", () => {
    const experimentId = faker.string.uuid();
    const params = { experimentId, tableName: "raw_data" };
    const columns = [
      { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP", position: 0 },
      { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE", position: 1 },
    ];

    function metadataAt(schemaRevision: string | null): ExperimentTableMetadata[] {
      return [
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 10,
          latestRowAt: null,
          schemaRevision,
          macroSchema: null,
          questionsSchema: null,
          customMetadataSchema: null,
        },
      ];
    }

    beforeEach(() => {
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
        success("SELECT * FROM raw_data LIMIT 1"),
      );
    });

    it("reads the columns once per schema revision", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(metadataAt("r1")),
      );
      const executeSpy = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success({ columns, rows: [], totalRows: 0, truncated: false }));

      const first = await repository.getTableColumns(params);
      const second = await repository.getTableColumns(params);

      assertSuccess(first);
      assertSuccess(second);
      expect(second.value).toEqual(columns);
      expect(executeSpy).toHaveBeenCalledTimes(1);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: "raw_data", limit: 1 }),
      );
    });

    it("reads them again once the schema revision moves", async () => {
      const metadataSpy = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(success(metadataAt("r1")));
      const executeSpy = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success({ columns, rows: [], totalRows: 0, truncated: false }));

      await repository.getTableColumns(params);
      metadataSpy.mockResolvedValue(success(metadataAt("r2")));
      await testApp.module.get<CachePort>(CACHE_PORT).invalidate(`table-metadata:${experimentId}`);
      await repository.getTableColumns(params);

      expect(executeSpy).toHaveBeenCalledTimes(2);
    });

    it("does not cache a failed read", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(metadataAt("r1")),
      );
      const error = AppError.internal("warehouse unavailable");
      const executeSpy = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValueOnce(failure(error))
        .mockResolvedValueOnce(success({ columns, rows: [], totalRows: 0, truncated: false }));

      const first = await repository.getTableColumns(params);
      const second = await repository.getTableColumns(params);

      assertFailure(first);
      expect(first.error).toBe(error);
      assertSuccess(second);
      expect(second.value).toEqual(columns);
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });

    it("describes a renamed payload field the way a data read does", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            ...metadataAt("r1")[0],
            identifier: "macro_123",
            tableType: "macro",
            macroSchema: "OBJECT<device: STRING, phi2: DOUBLE>",
          },
        ]),
      );
      vi.spyOn(databricksPort, "getExperimentTableColumns").mockResolvedValue(
        success(["id", "device", "macro_id", "macro_output", "questions_data"]),
      );
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [
            {
              name: "device",
              type_name: "STRUCT",
              type_text: "STRUCT<serial: STRING>",
              position: 0,
            },
            { name: "device_output", type_name: "STRING", type_text: "STRING", position: 1 },
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      );

      const result = await repository.getTableColumns({ experimentId, tableName: "macro_123" });

      assertSuccess(result);
      expect(result.value[1]).toEqual({
        name: "device_output",
        type_name: "STRING",
        type_text: "STRING",
        position: 1,
        renamedFrom: { name: "device", source: "macro_output" },
      });
    });

    it("returns notFound when the table is absent from metadata", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.getTableColumns(params);

      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
