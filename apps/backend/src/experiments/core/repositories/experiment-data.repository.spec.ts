import { faker } from "@faker-js/faker";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";
import { expect } from "vitest";

import {
  DATA_QUERY_MAX_LIMIT,
  WellKnownColumnTypes,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { AggregationSpec } from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import {
  AppError,
  success,
  failure,
  assertSuccess,
  assertFailure,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import type { AnnotationRecord } from "../models/experiment-data-annotation.model";
import type {
  ExperimentDataSource,
  ExperimentTableMetadata,
} from "../models/experiment-data.model";
import type { ExperimentDto } from "../models/experiment.model";
import { CACHE_PORT } from "../ports/cache.port";
import type { CachePort } from "../ports/cache.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";
import { SERVING_STORE_PORT } from "../ports/serving-store.port";
import type { ServingStorePort } from "../ports/serving-store.port";
import { ExperimentAnnotationsRepository } from "./experiment-annotations.repository";
import { ExperimentDataRepository } from "./experiment-data.repository";

/* eslint-disable @typescript-eslint/unbound-method */

type ExperimentQuery = Parameters<DatabricksPort["buildExperimentQuery"]>[0];

const WAREHOUSE: ExperimentDataSource = "warehouse";

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

  it.each(["static", "macro"] as const)(
    "keeps %s client ids available for labels but hidden from user columns",
    async (tableType) => {
      const experimentId = faker.string.uuid();
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "raw_data",
            tableType,
            displayName: null,
            rowCount: 1,
            latestRowAt: null,
            schemaRevision: "client-id",
            macroSchema: tableType === "macro" ? "OBJECT<client_id: STRING>" : null,
            questionsSchema: tableType === "static" ? "OBJECT<client_id: STRING>" : null,
          },
        ]),
      );
      vi.spyOn(databricksPort, "getExperimentTableColumns").mockResolvedValue(
        success([...VIEW_COLUMNS, "client_id"]),
      );
      const build = vi
        .spyOn(databricksPort, "buildExperimentQuery")
        .mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [{ name: "client_id", type_name: "STRING", type_text: "STRING", position: 0 }],
          rows: [["user-defined"]],
          totalRows: 1,
          truncated: false,
        }),
      );
      const result = await repository.getTableColumns({
        experimentId,
        tableName: "raw_data",
        source: WAREHOUSE,
      });
      assertSuccess(result);
      expect(build).toHaveBeenCalledWith(
        expect.objectContaining({
          baseColumns: [...VIEW_COLUMNS, "client_id"],
          reservedColumns: VIEW_COLUMNS,
        }),
      );
      expect(build.mock.calls[0]?.[0].exceptColumns).toContain("client_id");
      expect(result.value[0]).not.toHaveProperty("renamedFrom");
    },
  );

  describe("getTableData", () => {
    const experimentId = faker.string.uuid();

    const baseParams = {
      experimentId,
      experiment: mockExperiment,
      tableName: "raw_data",
      source: WAREHOUSE,
    };

    it("should successfully get table data with pagination", async () => {
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
        baseColumns: VIEW_COLUMNS,
        tableName: "raw_data",
        tableType: "static",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id", "questions_data", "custom_metadata"],
        ordering: undefined,
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

      const listing = await repository.tablesMetadata(experimentId, WAREHOUSE);
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
          displayName: null,
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
        success({
          columns: [
            {
              name: "contributor",
              type_name: "STRUCT",
              type_text: WellKnownColumnTypes.CONTRIBUTOR,
              position: 0,
            },
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
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

      // The table's column types, then the read: the pseudonym is recomputed in SQL, not reversed.
      expect(databricksPort.executeSqlQuery).toHaveBeenCalledTimes(2);
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
          displayName: null,
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

    describe("sorting by contributor", () => {
      const rawData: ExperimentTableMetadata = {
        identifier: "raw_data",
        displayName: "Raw data",
        tableType: "static",
        rowCount: 10,
        latestRowAt: null,
        schemaRevision: null,
        macroSchema: null,
        questionsSchema: null,
        customMetadataSchema: null,
      };

      beforeEach(() => {
        vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
          success([rawData]),
        );
        vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
        vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
          success({
            columns: [
              {
                name: "contributor",
                type_name: "STRUCT",
                type_text: WellKnownColumnTypes.CONTRIBUTOR,
                position: 0,
              },
              {
                name: "plot",
                type_name: "STRUCT",
                type_text: "STRUCT<id: STRING, name: STRING>",
                position: 1,
              },
            ],
            rows: [],
            totalRows: 0,
            truncated: false,
          }),
        );
      });

      it("orders an anonymized experiment by the pseudonym it shows, not the real name", async () => {
        await repository.getTableData({
          ...baseParams,
          experiment: { ...mockExperiment, anonymizeContributors: true },
          orderBy: "contributor.name",
          orderDirection: "DESC",
          page: 1,
          pageSize: 5,
        });

        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            ordering: {
              column: "contributor.id",
              direction: "DESC",
              mode: { kind: "pseudonym", salt: mockExperiment.id },
            },
          }),
        );
      });

      it("orders by the name when the experiment does not anonymize", async () => {
        await repository.getTableData({
          ...baseParams,
          experiment: { ...mockExperiment, anonymizeContributors: false },
          orderBy: "contributor.name",
          page: 1,
          pageSize: 5,
        });

        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            ordering: { column: "contributor.name", direction: "ASC" },
          }),
        );
      });

      it("keeps another struct's name order in an anonymized experiment", async () => {
        await repository.getTableData({
          ...baseParams,
          experiment: { ...mockExperiment, anonymizeContributors: true },
          orderBy: "plot.name",
          page: 1,
          pageSize: 5,
        });

        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            ordering: { column: "plot.name", direction: "ASC" },
          }),
        );
      });

      it("orders an anonymized aggregation by the pseudonym too", async () => {
        const aggregation: AggregationSpec = {
          groupBy: [{ column: "contributor" }],
          functions: [{ column: "value", function: "avg" }],
        };

        await repository.getTableData({
          ...baseParams,
          experiment: { ...mockExperiment, anonymizeContributors: true },
          aggregation,
          orderBy: "contributor.name",
        });

        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            aggregation,
            ordering: {
              column: "contributor.id",
              direction: "ASC",
              mode: { kind: "pseudonym", salt: mockExperiment.id },
            },
          }),
        );
      });
    });

    describe("an anonymized experiment's contributors", () => {
      const rawData: ExperimentTableMetadata = {
        identifier: "raw_data",
        displayName: "Raw data",
        tableType: "static",
        rowCount: 10,
        latestRowAt: null,
        schemaRevision: null,
        macroSchema: null,
        questionsSchema: null,
        customMetadataSchema: null,
      };
      const anonymized = { ...mockExperiment, anonymizeContributors: true };

      beforeEach(() => {
        vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
          success([rawData]),
        );
        vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
        vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
          success({
            columns: [
              {
                name: "contributor",
                type_name: "STRUCT",
                type_text: WellKnownColumnTypes.CONTRIBUTOR,
                position: 0,
              },
              {
                name: "plot",
                type_name: "STRUCT",
                type_text: "STRUCT<id: STRING, name: STRING>",
                position: 1,
              },
            ],
            rows: [],
            totalRows: 0,
            truncated: false,
          }),
        );
      });

      it.each([
        ["selecting a contributor's name", { columns: ["contributor.name"] }],
        [
          "filtering by a contributor's name",
          { filters: [{ column: "contributor.name", operator: "contains", value: "Ali" }] },
        ],
        [
          "filtering by the contributor column itself",
          { filters: [{ column: "contributor", operator: "equals", value: "u1" }] },
        ],
        [
          "grouping by a contributor's id",
          { aggregation: { groupBy: [{ column: "contributor.id", alias: "who" }] } },
        ],
        [
          "counting a contributor's names",
          {
            aggregation: {
              functions: [{ column: "contributor.name", function: "count_distinct" }],
            },
          },
        ],
        [
          "sorting by a contributor's avatar",
          { orderBy: "contributor.avatar", page: 1, pageSize: 5 },
        ],
        ["selecting a contributor's name in another case", { columns: ["Contributor.name"] }],
        [
          "filtering by the contributor column in another case",
          { filters: [{ column: "CONTRIBUTOR", operator: "equals", value: "u1" }] },
        ],
        [
          "sorting by a contributor's avatar in another case",
          { orderBy: "CONTRIBUTOR.avatar", page: 1, pageSize: 5 },
        ],
      ] satisfies [string, Partial<Parameters<ExperimentDataRepository["getTableData"]>[0]>][])(
        "refuses %s",
        async (_case, request) => {
          const result = await repository.getTableData({
            ...baseParams,
            experiment: anonymized,
            ...request,
          });

          assertFailure(result);
          expect(result.error.statusCode).toBe(400);
          // Only the lookup of the table's column types ran.
          expect(databricksPort.executeSqlQuery).toHaveBeenCalledTimes(1);
        },
      );

      it("refuses the distinct values of a contributor's name", async () => {
        const result = await repository.getDistinctColumnValues({
          source: WAREHOUSE,
          experimentId: baseParams.experimentId,
          experiment: anonymized,
          tableName: "raw_data",
          column: "contributor.name",
          limit: 10,
        });

        assertFailure(result);
        expect(result.error.statusCode).toBe(400);
        expect(databricksPort.executeSqlQuery).toHaveBeenCalledTimes(1);
      });

      it("sorts by the contributor column itself in the order of its pseudonyms", async () => {
        await repository.getTableData({
          ...baseParams,
          experiment: anonymized,
          orderBy: "contributor",
          page: 1,
          pageSize: 5,
        });

        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            ordering: {
              column: "contributor.id",
              direction: "ASC",
              mode: { kind: "pseudonym", salt: mockExperiment.id },
            },
          }),
        );
      });

      it("sorts a contributor's name in another case by the pseudonym, under the column's own name", async () => {
        await repository.getTableData({
          ...baseParams,
          experiment: anonymized,
          orderBy: "Contributor.name",
          orderDirection: "DESC",
          page: 1,
          pageSize: 5,
        });

        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            ordering: {
              column: "contributor.id",
              direction: "DESC",
              mode: { kind: "pseudonym", salt: mockExperiment.id },
            },
          }),
        );
      });

      it("reads another struct's fields as they are", async () => {
        const result = await repository.getTableData({
          ...baseParams,
          experiment: anonymized,
          columns: ["plot.name"],
          filters: [{ column: "plot.id", operator: "equals", value: "p1" }],
          page: 1,
          pageSize: 5,
        });

        assertSuccess(result);
        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            columns: ["plot.name"],
            filters: [{ column: "plot.id", operator: "equals", value: "p1" }],
          }),
        );
      });

      it("leaves a contributor's fields readable when the experiment does not anonymize", async () => {
        const result = await repository.getTableData({
          ...baseParams,
          experiment: { ...mockExperiment, anonymizeContributors: false },
          columns: ["contributor.name"],
          filters: [{ column: "contributor.name", operator: "contains", value: "Ali" }],
          page: 1,
          pageSize: 5,
        });

        assertSuccess(result);
        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            columns: ["contributor.name"],
            filters: [{ column: "contributor.name", operator: "contains", value: "Ali" }],
          }),
        );
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
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
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
        baseColumns: VIEW_COLUMNS,
        tableName: "raw_data",
        tableType: "static",
        experimentId,
        columns: ["id", "value"],
        variants: [
          { columnName: "questions_data", schema: "STRUCT<q1: STRING, q2: INT>", suffix: "answer" },
        ],
        reservedColumns: VIEW_COLUMNS,
        exceptColumns: ["experiment_id", "custom_metadata"],
        ordering: undefined,
        limit: DATA_QUERY_MAX_LIMIT + 1,
        offset: undefined,
      });
    });

    describe("one-page reads stop at a ceiling", () => {
      const metadata: ExperimentTableMetadata[] = [
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
      const columns = [{ name: "id", type_name: "string", type_text: "string", position: 0 }];

      function answer(rows: string[][], total: number) {
        return vi
          .spyOn(databricksPort, "executeSqlQuery")
          .mockImplementation((_schema, sql) =>
            Promise.resolve(
              success(
                sql.startsWith("SELECT COUNT")
                  ? { columns, rows: [[String(total)]], totalRows: 1, truncated: false }
                  : { columns, rows, totalRows: rows.length, truncated: false },
              ),
            ),
          );
      }

      beforeEach(() => {
        vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
        vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(
          success("SELECT id FROM raw_data"),
        );
      });

      it("returns the rows up to the ceiling, flags the rest and counts every match", async () => {
        const executeSpy = answer([["1"], ["2"], ["3"]], 7);

        const result = await repository.getTableData({ ...baseParams, columns: ["id"], limit: 2 });

        assertSuccess(result);
        expect(result.value[0]).toMatchObject({ pageSize: 2, totalRows: 7, totalPages: 1 });
        expect(result.value[0].data).toMatchObject({
          rows: [{ id: "1" }, { id: "2" }],
          totalRows: 7,
          truncated: true,
        });
        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({ columns: ["id"], limit: 3 }),
        );
        expect(executeSpy).toHaveBeenCalledTimes(2);
      });

      it("flags a read the warehouse cut at its byte limit and counts every match", async () => {
        vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation((_schema, sql) =>
          Promise.resolve(
            success(
              sql.startsWith("SELECT COUNT")
                ? { columns, rows: [["9"]], totalRows: 1, truncated: false }
                : { columns, rows: [["1"], ["2"]], totalRows: 2, truncated: true },
            ),
          ),
        );

        const result = await repository.getTableData({ ...baseParams, columns: ["id"] });

        assertSuccess(result);
        expect(result.value[0].data).toMatchObject({
          rows: [{ id: "1" }, { id: "2" }],
          totalRows: 9,
          truncated: true,
        });
      });

      it("refuses a page the warehouse cut at its byte limit rather than return it short", async () => {
        vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
          success({ columns, rows: [["1"]], totalRows: 1, truncated: true }),
        );

        const result = await repository.getTableData({ ...baseParams, page: 1, pageSize: 50 });

        assertFailure(result);
        expect(result.error.code).toBe("PAGE_TOO_LARGE");
      });

      it("reads no count when every match fits under the ceiling", async () => {
        const executeSpy = answer([["1"], ["2"]], 2);

        const result = await repository.getTableData({ ...baseParams, columns: ["id"], limit: 2 });

        assertSuccess(result);
        expect(result.value[0].data).toMatchObject({ totalRows: 2, truncated: false });
        expect(executeSpy).toHaveBeenCalledTimes(1);
      });

      it("applies the same ceiling to aggregated reads", async () => {
        answer([["a"], ["b"]], 5);

        const result = await repository.getTableData({
          ...baseParams,
          aggregation: { groupBy: [{ column: "id" }] },
          limit: 1,
        });

        assertSuccess(result);
        expect(result.value[0].data).toMatchObject({
          rows: [{ id: "a" }],
          totalRows: 5,
          truncated: true,
        });
        expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
          expect.objectContaining({ aggregation: { groupBy: [{ column: "id" }] }, limit: 2 }),
        );
      });

      it("fails the read when the count behind a truncated read fails", async () => {
        const error = AppError.internal("count failed");
        vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation((_schema, sql) =>
          Promise.resolve(
            sql.startsWith("SELECT COUNT")
              ? failure(error)
              : success({ columns, rows: [["1"], ["2"]], totalRows: 2, truncated: false }),
          ),
        );

        const result = await repository.getTableData({ ...baseParams, columns: ["id"], limit: 1 });

        assertFailure(result);
        expect(result.error).toBe(error);
      });
    });

    it("should handle macro tables with both schemas", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "macro_123",
          tableType: "macro",
          displayName: null,
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
        baseColumns: VIEW_COLUMNS,
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
        ordering: undefined,
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
            displayName: null,
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

    it("looks each view's columns up once across reads with and without payloads", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "macro_123",
            tableType: "macro",
            displayName: null,
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
            displayName: null,
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

      expect(databricksPort.getExperimentTableColumns).toHaveBeenCalledTimes(2);
      expect(databricksPort.getExperimentTableColumns).toHaveBeenCalledWith("macro", "macro_123");
      expect(databricksPort.getExperimentTableColumns).toHaveBeenCalledWith("static", "device");
    });

    it("should exclude macro_output when schema is missing for macro tables", async () => {
      const mockMetadata: ExperimentTableMetadata[] = [
        {
          identifier: "macro_123",
          tableType: "macro",
          displayName: null,
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
        baseColumns: VIEW_COLUMNS,
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
        ordering: undefined,
        limit: 5,
        offset: 0,
      });
    });

    it("should exclude questions_data when schema is missing", async () => {
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
        baseColumns: VIEW_COLUMNS,
        tableName: "raw_data",
        tableType: "static",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id", "questions_data", "custom_metadata"],
        ordering: undefined,
        limit: 5,
        offset: 0,
      });
    });

    it("should handle device table type correctly", async () => {
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
        baseColumns: VIEW_COLUMNS,
        tableName: "device",
        tableType: "static",
        experimentId,
        columns: undefined,
        variants: undefined,
        exceptColumns: ["experiment_id"],
        ordering: undefined,
        limit: 5,
        offset: 0,
      });
    });

    it("should return failure when executeSqlQuery fails for full table data", async () => {
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
    const readParams = {
      experimentId: faker.string.uuid(),
      experiment: mockExperiment,
      source: WAREHOUSE,
    };
    const macroTable: ExperimentTableMetadata = {
      identifier: "macro_123",
      tableType: "macro",
      displayName: null,
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
        source: WAREHOUSE,
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
        source: WAREHOUSE,
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
            displayName: null,
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
            displayName: null,
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
        source: WAREHOUSE,
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
        source: WAREHOUSE,
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
          displayName: null,
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
        source: WAREHOUSE,
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
          displayName: null,
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
        source: WAREHOUSE,
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
      source: WAREHOUSE,
    };
    const metadata: ExperimentTableMetadata[] = [
      {
        identifier: "raw_data",
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
          ordering: { column: "site", direction: "ASC" },
          limit: 11,
        }),
      );
    });

    it("projects device names before distinct, sorting and paging", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success(mockRows(["Bench (d1)", "Bench (d2)"])),
      );

      const result = await repository.getDistinctColumnValues({
        ...baseParams,
        column: "device",
        offset: 200,
      });

      assertSuccess(result);
      expect(result.value.values).toEqual(["Bench (d1)", "Bench (d2)"]);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: ["device.serial_number"],
          distinct: undefined,
          limit: undefined,
          offset: undefined,
        }),
      );
      expect(databricksPort.executeSqlQuery).toHaveBeenCalledWith(
        expect.any(String),
        "SELECT DISTINCT `serial_number` FROM (SELECT ...) AS device_names WHERE `serial_number` IS NOT NULL AND trim(`serial_number`) <> '' ORDER BY lower(`serial_number`) ASC, `serial_number` ASC LIMIT 4 OFFSET 200",
      );
    });

    it.each(["static", "macro"] as const)(
      "builds executable device-name projection for a %s table",
      async (tableType) => {
        vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
          success([
            {
              ...metadata[0],
              tableType,
              macroSchema: tableType === "macro" ? "OBJECT<device: STRING>" : null,
            },
          ]),
        );
        const execute = vi
          .spyOn(databricksPort, "executeSqlQuery")
          .mockResolvedValue(success(mockRows(["Ambit (d2)", "Ambit (d3)"])));
        const result = await repository.getDistinctColumnValues({
          ...baseParams,
          column: "device",
          offset: 200,
        });
        assertSuccess(result);
        expect(execute.mock.calls[0][1]).toContain("SELECT `device`.`serial_number`");
        expect(execute.mock.calls[0][1]).toContain("SELECT DISTINCT `serial_number`");
        expect(execute.mock.calls[0][1]).toContain("WHERE `experiment_id` =");
        expect(execute.mock.calls[0][1]).toContain(
          "ORDER BY lower(`serial_number`) ASC, `serial_number` ASC LIMIT 4 OFFSET 200",
        );
      },
    );

    it("rejects nonzero offsets for non-device columns", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      const result = await repository.getDistinctColumnValues({ ...baseParams, offset: 200 });
      assertFailure(result);
      expect(result.error.message).toContain("only for device columns");
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

    it("flags values the warehouse cut at its byte limit", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT ..."));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({ ...mockRows(["a"]), truncated: true }),
      );

      const result = await repository.getDistinctColumnValues(baseParams);

      assertSuccess(result);
      expect(result.value).toEqual({ values: ["a"], truncated: true });
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

    it.each(["site", "device"])("propagates a %s query-builder failure", async (column) => {
      const error = AppError.badRequest("bad query");
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(failure(error));
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      const result = await repository.getDistinctColumnValues({ ...baseParams, column });
      assertFailure(result);
      expect(result.error).toBe(error);
      expect(execute).not.toHaveBeenCalled();
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
    const params = { experimentId, tableName: "raw_data", source: WAREHOUSE };
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
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(`table-metadata:warehouse:${experimentId}`);
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

      const result = await repository.getTableColumns({
        experimentId,
        tableName: "macro_123",
        source: WAREHOUSE,
      });

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
  describe("question answer sorting policy", () => {
    const empty = { columns: [], rows: [], totalRows: 0, truncated: false };
    const params = {
      experimentId: faker.string.uuid(),
      experiment: mockExperiment,
      page: 1,
      pageSize: 5,
      source: WAREHOUSE,
    };

    it.each([
      { source: "question", orderBy: "q", questionsSchema: "OBJECT<q: STRING>", numeric: true },
      {
        source: "empty ordering",
        orderBy: "",
        questionsSchema: "OBJECT<q: STRING>",
        numeric: false,
      },
      {
        source: "base collision",
        orderBy: "id_answer",
        questionsSchema: "OBJECT<id: STRING>",
        numeric: true,
      },
      {
        source: "case collision",
        orderBy: "ID_answer",
        questionsSchema: "OBJECT<ID: STRING>",
        numeric: true,
      },
      {
        source: "macro collision",
        orderBy: "q_answer_2",
        questionsSchema: "OBJECT<q: STRING>",
        macroSchema: "OBJECT<q: STRING, q_answer: STRING>",
        numeric: true,
      },
      {
        source: "native integer",
        orderBy: "q",
        questionsSchema: "OBJECT<q: BIGINT>",
        numeric: false,
      },
      {
        source: "native double",
        orderBy: "q",
        questionsSchema: "OBJECT<q: DOUBLE>",
        numeric: false,
        number: true,
      },
      {
        source: "native boolean",
        orderBy: "q",
        questionsSchema: "OBJECT<q: BOOLEAN>",
        numeric: false,
      },
      {
        source: "mixed types",
        orderBy: "q",
        questionsSchema: "OBJECT<q: VARIANT>",
        numeric: false,
      },
      {
        source: "macro output",
        orderBy: "q",
        questionsSchema: "OBJECT<q: STRING>",
        macroSchema: "OBJECT<q: STRING>",
        numeric: false,
      },
      {
        source: "metadata answer suffix",
        orderBy: "q_answer",
        questionsSchema: "OBJECT<q: STRING>",
        customMetadataSchema: "OBJECT<q_answer: STRING>",
        numeric: false,
      },
    ])(
      "uses the resolved source for $source",
      async ({ orderBy, questionsSchema, macroSchema, customMetadataSchema, numeric, number }) => {
        vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
          success([
            {
              identifier: "fixture",
              tableType: "macro",
              displayName: null,
              rowCount: 100,
              latestRowAt: null,
              schemaRevision: null,
              questionsSchema,
              macroSchema,
              customMetadataSchema,
            },
          ]),
        );
        const build = vi
          .spyOn(databricksPort, "buildExperimentQuery")
          .mockReturnValue(success("SELECT 1"));
        vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(empty));
        const result = await repository.getTableData({ ...params, tableName: "fixture", orderBy });
        assertSuccess(result);
        if (orderBy === "") expect(build.mock.calls[0][0].ordering).toBeUndefined();
        const mode = numeric ? "numericString" : number ? "number" : undefined;
        expect(build.mock.calls[0][0].ordering?.mode).toEqual(
          mode ? { kind: mode, rowId: "id" } : undefined,
        );
      },
    );

    it("applies the same policy to the distinct picker", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: "raw_data",
            tableType: "static",
            displayName: null,
            rowCount: 100,
            latestRowAt: null,
            schemaRevision: null,
            questionsSchema: "OBJECT<q: STRING>",
          },
        ]),
      );
      const build = vi
        .spyOn(databricksPort, "buildExperimentQuery")
        .mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(empty));
      const result = await repository.getDistinctColumnValues({
        ...params,
        tableName: "raw_data",
        column: "q",
        limit: 5,
      });
      assertSuccess(result);
      expect(build).toHaveBeenCalledWith(
        expect.objectContaining({
          distinct: true,
          columns: ["q"],
          ordering: { column: "q", direction: "ASC", mode: { kind: "numericString", rowId: "id" } },
          limit: 6,
        }),
      );
    });

    const rawData: ExperimentTableMetadata = {
      identifier: "raw_data",
      tableType: "static",
      displayName: null,
      rowCount: 100,
      latestRowAt: null,
      schemaRevision: null,
      questionsSchema: "OBJECT<q: STRING>",
    };

    it.each(["ASC", "DESC"] as const)(
      "orders a chart's filtered rows by answer value %s before the ceiling",
      async (orderDirection) => {
        vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
          success([rawData]),
        );
        const execute = vi
          .spyOn(databricksPort, "executeSqlQuery")
          .mockResolvedValue(success(empty));
        const filters = [{ column: "q", operator: "contains" as const, value: "0" }];

        const result = await repository.getTableData({
          source: WAREHOUSE,
          experimentId: params.experimentId,
          experiment: mockExperiment,
          tableName: "raw_data",
          columns: ["id", "q"],
          filters,
          orderBy: "q",
          orderDirection,
          limit: 10,
        });

        assertSuccess(result);
        const sql = execute.mock.calls[0][1];
        expect(sql).toMatch(/^SELECT \* EXCEPT \(`__numeric_order_group`, /);
        expect(sql).toContain(
          "\nSELECT `id`, try_variant_get(`questions_data`, '$[\"q\"]', 'STRING') AS `q`, ",
        );
        expect(sql).toContain("LIKE '%0%'");
        expect(sql).toContain(
          `ORDER BY \`__numeric_order_group\` ASC, (\`__numeric_order_decimal\`) ${orderDirection}, \`__numeric_order_value\` ${orderDirection} NULLS LAST, \`__numeric_order_row\` ASC\nLIMIT 11`,
        );
      },
    );

    it("orders a grouped answer by the plain output", async () => {
      const aggregation = {
        groupBy: [{ column: "q" }],
        functions: [{ column: "id", function: "count" as const }],
      };
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([rawData]));
      const execute = vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(empty));

      const result = await repository.getTableData({
        source: WAREHOUSE,
        experimentId: params.experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        aggregation,
        orderBy: "q",
        orderDirection: "DESC",
      });

      assertSuccess(result);
      const sql = execute.mock.calls[0][1];
      expect(sql).toMatch(/ORDER BY `q` DESC LIMIT 100001$/);
      expect(sql).not.toContain("DECIMAL(38, 18)");
      expect(sql).not.toContain("__numeric_order");
    });

    it("reads an empty aggregation as rows ordered by answer value", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([rawData]));
      const execute = vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(success(empty));

      const result = await repository.getTableData({
        ...params,
        tableName: "raw_data",
        aggregation: {},
        orderBy: "q",
      });

      assertSuccess(result);
      expect(execute.mock.calls[0][1]).toMatch(/^SELECT \* EXCEPT \(`__numeric_order_group`, /);
    });
  });
  describe("time-matched second table", () => {
    const experimentId = mockExperiment.id;
    const join = {
      tableName: "weather",
      matchColumn: "station",
      primaryTimeColumn: "timestamp",
      secondaryTimeColumn: "timestamp",
      toleranceMinutes: 5,
    };
    const column = (name: string, type_text: string) => ({
      name,
      type_name: type_text,
      type_text,
      position: 0,
    });
    const baseColumns = [
      column("id", "STRING"),
      column("timestamp", "TIMESTAMP"),
      column("station", "STRING"),
      column("contributor", WellKnownColumnTypes.CONTRIBUTOR),
    ];
    const metadata = ["raw_data", "weather"].map((identifier) => ({
      identifier,
      tableType: identifier === "raw_data" ? "static" : "upload",
      rowCount: 2,
      displayName: null,
      latestRowAt: null,
      schemaRevision: "r1",
      macroSchema: null,
      questionsSchema: null,
      customMetadataSchema: null,
      uploadSchema: null,
    })) as ExperimentTableMetadata[];

    beforeEach(() => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success(metadata));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockImplementation((input) =>
        success(input.join ? "joined" : `columns ${input.tableName}`),
      );
      vi.spyOn(databricksPort, "executeSqlQuery").mockImplementation((_schema, query) =>
        Promise.resolve(
          success({
            columns:
              query === "joined"
                ? [
                    column("id", "STRING"),
                    column("second__contributor", WellKnownColumnTypes.CONTRIBUTOR),
                  ]
                : baseColumns,
            rows:
              query === "joined"
                ? [
                    [
                      "p1",
                      JSON.stringify({ id: "person", name: "Private Name", avatar: "private" }),
                    ],
                    ["p2", null],
                  ]
                : [],
            totalRows: query === "joined" ? 2 : 0,
            truncated: false,
          }),
        ),
      );
    });

    it("resolves both shapes in the same experiment and describes secondary aliases", async () => {
      const result = await repository.getTableColumns({
        source: WAREHOUSE,
        experimentId,
        tableName: "raw_data",
        join,
      });
      assertSuccess(result);
      expect(result.value.find((c) => c.name === "second__station")?.sourceTable).toEqual({
        tableName: "weather",
        columnName: "station",
      });
      expect(databricksPort.getExperimentTableMetadata).toHaveBeenCalledWith(experimentId, {
        includeSchemas: true,
      });
    });

    it("passes a scoped semantic secondary source and anonymizes joined contributor cells", async () => {
      const result = await repository.getTableData({
        source: WAREHOUSE,
        experimentId,
        experiment: { ...mockExperiment, anonymizeContributors: true },
        tableName: "raw_data",
        columns: ["id", "second__contributor"],
        join,
      });
      assertSuccess(result);
      const data = result.value[0].data;
      if (!data) throw new Error("Expected joined data");
      const rows = data.rows;
      const contributor = rows[0].second__contributor;
      if (typeof contributor !== "string") throw new Error("Expected contributor struct");
      const parsed: unknown = JSON.parse(contributor);
      expect(parsed).toMatchObject({ avatar: null });
      expect(contributor).toMatch(/Contributor-[A-F0-9]{6}/);
      expect(rows[1]).toEqual({ id: "p2", second__contributor: null });
      expect(JSON.stringify(result.value)).not.toContain("Private Name");
      const query = vi
        .mocked(databricksPort.buildExperimentQuery)
        .mock.calls.find(([input]) => input.join)?.[0];
      expect(query?.experimentId).toBe(experimentId);
      expect(query?.join?.secondary.tableName).toBe("weather");
      expect(query?.join?.secondary.tableType).toBe("upload");
      expect(query?.join?.primaryColumns).toEqual(baseColumns.map((c) => c.name));
    });

    it("pseudonymizes secondary contributor filters and ordering", async () => {
      const result = await repository.getTableData({
        source: WAREHOUSE,
        experimentId,
        experiment: { ...mockExperiment, anonymizeContributors: true },
        tableName: "raw_data",
        columns: ["second__contributor"],
        join,
        filters: [
          { column: "second__contributor.id", operator: "equals", value: "Contributor-ABC123" },
        ],
        orderBy: "second__contributor.name",
      });
      assertSuccess(result);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            {
              column: "second__contributor.id",
              operator: "equals",
              value: "Contributor-ABC123",
              contributorPseudonymSalt: experimentId,
            },
          ],
          ordering: {
            column: "second__contributor.id",
            direction: "ASC",
            mode: { kind: "pseudonym", salt: experimentId },
          },
        }),
      );
    });

    it("prefers literal dotted names over contributor paths when anonymizing a joined read", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [
            ...baseColumns,
            column("Plant.id", "STRING"),
            column("Plant.name", "STRING"),
            column("Plant", WellKnownColumnTypes.CONTRIBUTOR),
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      );
      const filters = [{ column: "Plant.id", operator: "equals" as const, value: "literal" }];
      const result = await repository.getTableData({
        source: WAREHOUSE,
        experimentId,
        experiment: { ...mockExperiment, anonymizeContributors: true },
        tableName: "raw_data",
        columns: ["Plant.id"],
        join,
        filters,
        orderBy: "Plant.name",
      });
      assertSuccess(result);
      const query = vi
        .mocked(databricksPort.buildExperimentQuery)
        .mock.calls.find(([input]) => input.join)?.[0];
      expect(query?.filters).toEqual(filters);
      expect(query?.ordering).toEqual({ column: "Plant.name", direction: "ASC" });
    });

    it("rejects a secondary table absent from the experiment before querying it", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success(metadata.slice(0, 1)),
      );
      const result = await repository.getTableData({
        source: WAREHOUSE,
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        join,
      });
      assertFailure(result);
      expect(databricksPort.executeSqlQuery).not.toHaveBeenCalled();
    });

    it("rejects unsupported timestamp columns", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [
            column("id", "STRING"),
            column("timestamp", "STRING"),
            column("station", "STRING"),
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      );
      const result = await repository.getTableData({
        source: WAREHOUSE,
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        join,
      });
      assertFailure(result);
      expect(result.error.message).toContain("timestamp or date");
    });
  });

  describe("reading from the store", () => {
    const experimentId = faker.string.uuid();
    const storeColumns = [
      { name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 },
      { name: "plot", type_name: "STRING", type_text: "STRING", position: 1 },
    ];
    let servingStore: ServingStorePort;

    const largeTable: ExperimentTableMetadata = {
      identifier: "raw_data",
      tableType: "static",
      displayName: null,
      rowCount: 1_000_000,
      latestRowAt: null,
      schemaRevision: "r1",
      questionsSchema: "OBJECT<plot: STRING>",
    };

    beforeEach(() => {
      servingStore = testApp.module.get(SERVING_STORE_PORT);
      vi.spyOn(servingStore, "getExperimentTableMetadata").mockResolvedValue(success([largeTable]));
    });

    it("reads a large table's page in one statement, never picking it by id first", async () => {
      const execute = vi
        .spyOn(servingStore, "executeQuery")
        .mockResolvedValue(
          success({ columns: storeColumns, rows: [["1", "A1"]], totalRows: 1, truncated: false }),
        );
      const warehouse = vi.spyOn(databricksPort, "executeSqlQuery");

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        page: 2,
        pageSize: 10,
        source: "store",
      });

      assertSuccess(result);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0][0].sql).toContain("LIMIT 10\nOFFSET 10");
      expect(warehouse).not.toHaveBeenCalled();
      expect(result.value[0]).toMatchObject({ totalRows: 1_000_000, page: 2 });
      expect(result.value[0].data?.rows).toEqual([{ id: "1", plot: "A1" }]);
    });

    it("sorts a text answer by its numeric value in the store", async () => {
      const execute = vi
        .spyOn(servingStore, "executeQuery")
        .mockResolvedValue(
          success({ columns: storeColumns, rows: [["1", "A1"]], totalRows: 1, truncated: false }),
        );

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        orderBy: "plot",
        orderDirection: "DESC",
        page: 1,
        pageSize: 10,
        source: "store",
      });

      assertSuccess(result);
      expect(execute.mock.calls[0][0].sql).toContain("toDecimal128OrNull");
    });

    it("counts a filtered page in the store", async () => {
      const countSql = "SELECT toString(count()) AS total";
      const execute = vi.spyOn(servingStore, "executeQuery").mockImplementation(({ sql }) =>
        Promise.resolve(
          sql.startsWith(countSql)
            ? success({
                columns: [{ name: "total", type_name: "LONG", type_text: "BIGINT", position: 0 }],
                rows: [["3"]],
                totalRows: 1,
                truncated: false,
              })
            : success({
                columns: storeColumns,
                rows: [["1", "A1"]],
                totalRows: 1,
                truncated: false,
              }),
        ),
      );

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        filters: [{ column: "plot", operator: "equals", value: "A1" }],
        page: 1,
        pageSize: 10,
        source: "store",
      });

      assertSuccess(result);
      expect(execute).toHaveBeenCalledTimes(2);
      expect(result.value[0].totalRows).toBe(3);
      expect(result.value[0].data?.rows).toEqual([{ id: "1", plot: "A1" }]);
    });

    it("keeps charts' reads on the warehouse until the store aggregates", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([largeTable]),
      );
      const warehouse = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(
          success({ columns: storeColumns, rows: [["1", "A1"]], totalRows: 1, truncated: false }),
        );
      const store = vi.spyOn(servingStore, "executeQuery");

      await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        aggregation: { groupBy: [{ column: "plot" }] },
        source: "store",
      });
      await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        columns: ["plot"],
        source: "store",
      });

      expect(warehouse).toHaveBeenCalled();
      expect(store).not.toHaveBeenCalled();
    });

    it("keeps a read joined to a second table on the warehouse, paged or not", async () => {
      const store = vi.spyOn(servingStore, "executeQuery");
      const warehouseMetadata = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(success([]));

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        join: {
          tableName: "macro_1",
          matchColumn: "device_id",
          primaryTimeColumn: "timestamp",
          secondaryTimeColumn: "timestamp",
          toleranceMinutes: 5,
        },
        page: 1,
        pageSize: 10,
        source: "store",
      });

      assertFailure(result);
      expect(warehouseMetadata).toHaveBeenCalled();
      expect(servingStore.getExperimentTableMetadata).not.toHaveBeenCalled();
      expect(store).not.toHaveBeenCalled();
    });

    it("reads a table the store does not hold from the warehouse", async () => {
      const deviceTable: ExperimentTableMetadata = {
        ...largeTable,
        identifier: "device",
        rowCount: 2,
        questionsSchema: null,
      };
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([deviceTable]),
      );
      const warehouse = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success({ columns: [], rows: [], totalRows: 0, truncated: false }));
      const store = vi.spyOn(servingStore, "executeQuery");

      const result = await repository.getTableData({
        experimentId,
        experiment: mockExperiment,
        tableName: "device",
        page: 1,
        pageSize: 10,
        source: "store",
      });

      assertSuccess(result);
      expect(warehouse).toHaveBeenCalled();
      expect(store).not.toHaveBeenCalled();
    });

    it("reads Device picker labels from the warehouse when the source is store", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([largeTable]),
      );
      vi.spyOn(databricksPort, "getExperimentTableColumns").mockResolvedValue(
        success([...VIEW_COLUMNS, "client_id", "device_name", "device_id"]),
      );
      const labels = ["Ambit (d2)", "Ambit (d3)", "phone (d4)"];
      const warehouse = vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [
            { name: "serial_number", type_name: "STRING", type_text: "STRING", position: 0 },
          ],
          rows: labels.map((label) => [label]),
          totalRows: labels.length,
          truncated: false,
        }),
      );
      vi.spyOn(servingStore, "getExperimentIds").mockResolvedValue(success(["phone"]));
      const store = vi.spyOn(servingStore, "executeQuery").mockResolvedValue(
        success({
          columns: [
            {
              name: "device",
              type_name: "STRUCT",
              type_text: WellKnownColumnTypes.DEVICE,
              position: 0,
            },
          ],
          rows: [["phone"]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getDistinctColumnValues({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        column: "device",
        limit: 3,
        offset: 200,
        source: "store",
      });

      assertSuccess(result);
      expect(result.value).toEqual({ values: labels, truncated: false });
      expect(store).not.toHaveBeenCalled();
      const sql = warehouse.mock.calls[0][1];
      expect(sql).toContain("named_struct(");
      expect(sql).toContain("nullif(trim(`device_name`), '')");
      expect(sql).toContain("nullif(trim(`client_id`), '')");
      expect(sql).toContain("SELECT DISTINCT `serial_number`");
      expect(sql).toContain(
        "ORDER BY lower(`serial_number`) ASC, `serial_number` ASC LIMIT 4 OFFSET 200",
      );
    });

    it("returns a warehouse shape failure when routing the Device picker from the store", async () => {
      const error = AppError.internal("Warehouse metadata is unavailable");
      const metadata = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(failure(error));
      const warehouse = vi.spyOn(databricksPort, "executeSqlQuery");
      const store = vi.spyOn(servingStore, "executeQuery");

      const result = await repository.getDistinctColumnValues({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        column: "device",
        limit: 3,
        source: "store",
      });

      assertFailure(result);
      expect(result.error).toBe(error);
      expect(metadata).toHaveBeenCalledWith(experimentId, { includeSchemas: true });
      expect(warehouse).not.toHaveBeenCalled();
      expect(store).not.toHaveBeenCalled();
    });

    it("keeps non-device distinct reads on the store", async () => {
      const store = vi.spyOn(servingStore, "executeQuery").mockResolvedValue(
        success({
          columns: [{ name: "plot", type_name: "STRING", type_text: "STRING", position: 0 }],
          rows: [["A1"], ["B2"]],
          totalRows: 2,
          truncated: false,
        }),
      );
      const warehouse = vi.spyOn(databricksPort, "executeSqlQuery");
      const result = await repository.getDistinctColumnValues({
        experimentId,
        experiment: mockExperiment,
        tableName: "raw_data",
        column: "plot",
        limit: 3,
        source: "store",
      });

      assertSuccess(result);
      expect(result.value).toEqual({ values: ["A1", "B2"], truncated: false });
      expect(store).toHaveBeenCalled();
      expect(warehouse).not.toHaveBeenCalled();
    });

    describe("in an anonymized experiment", () => {
      const anonymized = { ...mockExperiment, anonymizeContributors: true };
      const contributorColumns = [
        { name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 },
        {
          name: "contributor",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.CONTRIBUTOR,
          position: 1,
        },
      ];

      it("refuses a filter on the contributor column itself, which compares real ids", async () => {
        const execute = vi
          .spyOn(servingStore, "executeQuery")
          .mockResolvedValue(
            success({ columns: contributorColumns, rows: [], totalRows: 0, truncated: false }),
          );

        const result = await repository.getTableData({
          experimentId,
          experiment: anonymized,
          tableName: "raw_data",
          filters: [{ column: "contributor", operator: "equals", value: faker.string.uuid() }],
          page: 1,
          pageSize: 10,
          source: "store",
        });

        assertFailure(result);
        expect(result.error.statusCode).toBe(400);
        // Only the lookup of the table's column types reached the store.
        expect(execute).toHaveBeenCalledTimes(1);
      });

      it("compares a contributor id filter as the pseudonym", async () => {
        const pseudo = new ContributorAnonymizerService().pseudonymFor(anonymized.id, "u1");
        const execute = vi
          .spyOn(servingStore, "executeQuery")
          .mockResolvedValue(
            success({ columns: contributorColumns, rows: [], totalRows: 0, truncated: false }),
          );

        const result = await repository.getTableData({
          experimentId,
          experiment: anonymized,
          tableName: "raw_data",
          filters: [{ column: "contributor.id", operator: "equals", value: pseudo }],
          page: 1,
          pageSize: 10,
          source: "store",
        });

        assertSuccess(result);
        const filtered = execute.mock.calls
          .map(([query]) => query.sql)
          .filter((sql) => sql.includes(pseudo));
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((sql) => sql.includes("concat('Contributor-'"))).toBe(true);
      });

      it("sorts by a contributor's name in the order of its pseudonyms", async () => {
        const execute = vi
          .spyOn(servingStore, "executeQuery")
          .mockResolvedValue(
            success({ columns: contributorColumns, rows: [], totalRows: 0, truncated: false }),
          );

        const result = await repository.getTableData({
          experimentId,
          experiment: anonymized,
          tableName: "raw_data",
          orderBy: "contributor.name",
          page: 1,
          pageSize: 10,
          source: "store",
        });

        assertSuccess(result);
        const page = execute.mock.calls.map(([query]) => query.sql).at(-1) ?? "";
        expect(page).toContain("ORDER BY concat('Contributor-'");
        expect(page).not.toContain("indexOf(");
      });
    });

    it("caches each source's tables apart", async () => {
      const warehouseListing = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(success([{ ...largeTable, rowCount: 5 }]));

      const fromStore = await repository.tablesMetadata(experimentId, "store");
      const fromWarehouse = await repository.tablesMetadata(experimentId, "warehouse");

      assertSuccess(fromStore);
      assertSuccess(fromWarehouse);
      expect(fromStore.value[0].rowCount).toBe(1_000_000);
      expect(fromWarehouse.value[0].rowCount).toBe(5);
      expect(warehouseListing).toHaveBeenCalledTimes(1);
    });
  });

  describe("a row's annotations", () => {
    const phoneComment = {
      id: "p1",
      rowId: "1",
      type: "comment",
      content: { text: "From the phone", flagType: null },
    };
    const table: ExperimentTableMetadata = {
      identifier: "raw_data",
      tableType: "static",
      displayName: null,
      rowCount: 1,
      latestRowAt: null,
      schemaRevision: "r1",
      macroSchema: null,
      questionsSchema: null,
      customMetadataSchema: null,
    };
    let experiment: ExperimentDto;
    let flag: AnnotationRecord;

    function column(name: string, position: number) {
      return { name, type_name: "STRING", type_text: "STRING", position };
    }

    function annotationsOf(rows: Record<string, string | null>[] | undefined): unknown[] {
      return (rows ?? []).map((row): unknown => JSON.parse(row.annotations ?? "null"));
    }

    beforeEach(async () => {
      const userId = await testApp.createTestUser({});
      const created = await testApp.createExperiment({ name: "Drought trial", userId });
      experiment = { ...mockExperiment, id: created.experiment.id };
      flag = {
        id: faker.string.uuid(),
        experimentId: experiment.id,
        tableName: "raw_data",
        rowId: "1",
        type: "flag",
        contentText: null,
        flagType: "outlier",
        createdBy: userId,
        createdAt: new Date("2026-09-01T08:00:00.000Z"),
        updatedAt: new Date("2026-09-01T08:00:00.000Z"),
      };
      const annotations = testApp.module.get(ExperimentAnnotationsRepository);
      assertSuccess(await annotations.transaction((tx) => annotations.insert(tx, [flag])));
    });

    it("reads the phone's from the warehouse's own column and the platform's from Postgres", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([table]));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [column("id", 0), column("annotations", 1), column("payload_annotations", 2)],
          rows: [
            [
              "1",
              JSON.stringify([phoneComment, { id: "stale lakehouse copy" }]),
              JSON.stringify([phoneComment]),
            ],
          ],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getTableData({
        experimentId: experiment.id,
        experiment,
        tableName: "raw_data",
        columns: ["id", "annotations"],
        source: WAREHOUSE,
      });

      assertSuccess(result);
      expect(databricksPort.buildExperimentQuery).toHaveBeenCalledWith(
        expect.objectContaining({ columns: ["id", "annotations", "payload_annotations"] }),
      );
      expect(result.value[0].data?.columns.map(({ name }) => name)).toEqual(["id", "annotations"]);
      expect(annotationsOf(result.value[0].data?.rows)).toEqual([
        [phoneComment, expect.objectContaining({ id: flag.id, type: "flag" })],
      ]);
    });

    it("adds the platform's from Postgres to a store page's", async () => {
      const servingStore = testApp.module.get<ServingStorePort>(SERVING_STORE_PORT);
      vi.spyOn(servingStore, "getExperimentTableMetadata").mockResolvedValue(success([table]));
      vi.spyOn(servingStore, "executeQuery").mockResolvedValue(
        success({
          columns: [column("id", 0), column("annotations", 1)],
          rows: [["1", JSON.stringify([phoneComment])]],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getTableData({
        experimentId: experiment.id,
        experiment,
        tableName: "raw_data",
        page: 1,
        pageSize: 10,
        source: "store",
      });

      assertSuccess(result);
      expect(annotationsOf(result.value[0].data?.rows)).toEqual([
        [phoneComment, expect.objectContaining({ id: flag.id, type: "flag" })],
      ]);
    });

    it("leaves the phone's own column out of a table's columns", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([table]));
      vi.spyOn(databricksPort, "buildExperimentQuery").mockReturnValue(success("SELECT 1"));
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        success({
          columns: [column("id", 0), column("annotations", 1), column("payload_annotations", 2)],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      );

      const result = await repository.getTableColumns({
        experimentId: experiment.id,
        tableName: "raw_data",
        source: WAREHOUSE,
      });

      assertSuccess(result);
      expect(result.value.map(({ name }) => name)).toEqual(["id", "annotations"]);
    });
  });
});
