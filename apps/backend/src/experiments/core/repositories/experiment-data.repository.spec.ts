import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  success,
  failure,
  assertSuccess,
  assertFailure,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";
import type { ExperimentDto } from "../models/experiment.model";
import { DELTA_PORT } from "../ports/delta.port";
import type { DeltaPort, DeltaQueryOptions } from "../ports/delta.port";
import { ExperimentDataRepository, parseVariantSchema } from "./experiment-data.repository";

/* eslint-disable @typescript-eslint/unbound-method */

describe("ExperimentDataRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataRepository;
  let deltaPort: DeltaPort;

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

  const baseColumns: SchemaData["columns"] = [
    { name: "id", type_name: "STRING", type_text: "STRING", position: 0 },
    { name: "experiment_id", type_name: "STRING", type_text: "STRING", position: 1 },
    { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP", position: 2 },
  ];

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataRepository);
    deltaPort = testApp.module.get(DELTA_PORT);
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

    const mockMetadata = (
      overrides: Partial<ExperimentTableMetadata> = {},
    ): ExperimentTableMetadata[] => [
      {
        identifier: "raw_data",
        tableType: "static",
        rowCount: 2,
        macroSchema: null,
        questionsSchema: null,
        customMetadataSchema: null,
        ...overrides,
      },
    ];

    it("returns failure when the table is not found", async () => {
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.getTableData(baseParams);

      assertFailure(result);
      expect(result.error.statusCode).toBe(404);
    });

    it("propagates metadata fetch errors", async () => {
      const error = AppError.internal("metadata down");
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(failure(error));

      const result = await repository.getTableData(baseParams);
      assertFailure(result);
      expect(result.error).toBe(error);
    });

    it("scopes static-table reads to the experiment via filters and resolves the physical table", async () => {
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(success(mockMetadata()));
      const dataSpy = vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({
          columns: baseColumns,
          rows: [
            { id: "1", experiment_id: experimentId, timestamp: "2024-01-01" },
            { id: "2", experiment_id: experimentId, timestamp: "2024-01-02" },
          ],
          totalRows: 2,
          truncated: false,
        }),
      );

      const result = await repository.getTableData(baseParams);

      assertSuccess(result);
      expect(dataSpy).toHaveBeenCalledWith(deltaPort.RAW_DATA_TABLE_NAME, {
        filter: { op: "eq", column: "experiment_id", value: experimentId },
      });
    });

    it("scopes macro-table reads to (experiment_id, macro_id) on the shared macro table", async () => {
      const macroId = faker.string.uuid();
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata({ identifier: macroId, tableType: "macro" })),
      );
      const dataSpy = vi
        .spyOn(deltaPort, "getTableData")
        .mockResolvedValue(
          success({ columns: baseColumns, rows: [], totalRows: 0, truncated: false }),
        );

      const result = await repository.getTableData({ ...baseParams, tableName: macroId });

      assertSuccess(result);
      expect(dataSpy).toHaveBeenCalledWith(deltaPort.MACRO_DATA_TABLE_NAME, {
        filter: {
          op: "and",
          filters: [
            { op: "eq", column: "experiment_id", value: experimentId },
            { op: "eq", column: "macro_id", value: macroId },
          ],
        },
      });
    });

    it("drops exceptColumns from rows + column metadata in the response", async () => {
      // experiment_id is in STATIC_TABLE_CONFIG.raw_data.exceptColumns
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(success(mockMetadata()));
      vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({
          columns: baseColumns,
          rows: [{ id: "1", experiment_id: experimentId, timestamp: "2024-01-01" }],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getTableData(baseParams);

      assertSuccess(result);
      const data = result.value[0].data!;
      expect(data.columns.map((c) => c.name)).not.toContain("experiment_id");
      expect(data.rows[0]).not.toHaveProperty("experiment_id");
      expect(data.rows[0]).toHaveProperty("id", "1");
    });

    it("flattens variant columns using the schema from metadata", async () => {
      const questionsSchema = "OBJECT<question_one: STRING, question_two: STRING>";
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata({ questionsSchema })),
      );
      vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({
          columns: [
            ...baseColumns,
            {
              name: "questions_data",
              type_name: "VARIANT",
              type_text: "VARIANT",
              position: 3,
            },
          ],
          rows: [
            {
              id: "1",
              experiment_id: experimentId,
              timestamp: "2024-01-01",
              questions_data: { question_one: "yes", question_two: "no" },
            },
          ],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getTableData(baseParams);

      assertSuccess(result);
      const data = result.value[0].data!;
      expect(data.columns.map((c) => c.name)).toEqual(
        expect.arrayContaining(["question_one", "question_two"]),
      );
      expect(data.columns.map((c) => c.name)).not.toContain("questions_data");
      expect(data.rows[0]).toMatchObject({
        question_one: "yes",
        question_two: "no",
      });
      expect(data.rows[0]).not.toHaveProperty("questions_data");
    });

    it("drops a variant column whose schema is null on this experiment", async () => {
      // raw_data has questions_data and custom_metadata variants; passing null
      // schemas should remove both columns entirely (matches the SQL builder's
      // `exceptColumns.push(variant)` fallback).
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(
        success(mockMetadata({ questionsSchema: null, customMetadataSchema: null })),
      );
      vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({
          columns: [
            ...baseColumns,
            { name: "questions_data", type_name: "VARIANT", type_text: "VARIANT", position: 3 },
            { name: "custom_metadata", type_name: "VARIANT", type_text: "VARIANT", position: 4 },
          ],
          rows: [
            {
              id: "1",
              experiment_id: experimentId,
              timestamp: "2024-01-01",
              questions_data: { something: "ignored" },
              custom_metadata: { other: "ignored" },
            },
          ],
          totalRows: 1,
          truncated: false,
        }),
      );

      const result = await repository.getTableData(baseParams);

      assertSuccess(result);
      const cols = result.value[0].data!.columns.map((c) => c.name);
      expect(cols).not.toContain("questions_data");
      expect(cols).not.toContain("custom_metadata");
    });

    it("paginates client-side and reports correct totals", async () => {
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(success(mockMetadata()));
      const allRows = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        experiment_id: experimentId,
        timestamp: `2024-01-${String(i + 1).padStart(2, "0")}`,
      }));
      vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({ columns: baseColumns, rows: allRows, totalRows: 12, truncated: false }),
      );

      const result = await repository.getTableData({ ...baseParams, page: 2, pageSize: 5 });

      assertSuccess(result);
      const tableData = result.value[0];
      expect(tableData.totalRows).toBe(12);
      expect(tableData.totalPages).toBe(3);
      expect(tableData.page).toBe(2);
      expect(tableData.data!.rows).toHaveLength(5);
      expect(tableData.data!.rows[0]).toMatchObject({ id: "5" });
    });

    it("sorts client-side by orderBy/orderDirection", async () => {
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(success(mockMetadata()));
      vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({
          columns: baseColumns,
          rows: [
            { id: "b", experiment_id: experimentId, timestamp: "2024-01-02" },
            { id: "a", experiment_id: experimentId, timestamp: "2024-01-01" },
            { id: "c", experiment_id: experimentId, timestamp: "2024-01-03" },
          ],
          totalRows: 3,
          truncated: false,
        }),
      );

      const result = await repository.getTableData({
        ...baseParams,
        orderBy: "id",
        orderDirection: "DESC",
        pageSize: 10,
      });

      assertSuccess(result);
      const ids = result.value[0].data!.rows.map((r) => r.id);
      expect(ids).toEqual(["c", "b", "a"]);
    });

    it("returns the full filtered set without pagination when specific columns are requested", async () => {
      vi.spyOn(deltaPort, "getExperimentTableMetadata").mockResolvedValue(success(mockMetadata()));
      vi.spyOn(deltaPort, "getTableData").mockResolvedValue(
        success({
          columns: baseColumns,
          rows: [
            { id: "1", experiment_id: experimentId, timestamp: "2024-01-01" },
            { id: "2", experiment_id: experimentId, timestamp: "2024-01-02" },
          ],
          totalRows: 2,
          truncated: false,
        }),
      );

      const result = await repository.getTableData({
        ...baseParams,
        columns: ["id"],
        page: 1,
        pageSize: 1,
      });

      assertSuccess(result);
      const tableData = result.value[0];
      expect(tableData.totalPages).toBe(1);
      expect(tableData.page).toBe(1);
      expect(tableData.pageSize).toBe(2);
      expect(tableData.data!.rows).toHaveLength(2);
      expect(tableData.data!.columns.map((c) => c.name)).toEqual(["id"]);
      // Argument forwarded to deltaPort
      const lastCall = vi.mocked(deltaPort.getTableData).mock.calls.at(-1)!;
      const opts = lastCall[1] as DeltaQueryOptions;
      expect(opts.filter).toEqual({ op: "eq", column: "experiment_id", value: experimentId });
    });
  });
});

describe("parseVariantSchema", () => {
  it("parses simple top-level fields", () => {
    expect(parseVariantSchema("OBJECT<a: STRING, b: BIGINT>")).toEqual([
      { name: "a", type: "STRING" },
      { name: "b", type: "BIGINT" },
    ]);
  });

  it("respects depth — commas inside nested OBJECT/ARRAY don't split fields", () => {
    expect(parseVariantSchema("OBJECT<a: ARRAY<STRING>, b: OBJECT<x: STRING, y: BIGINT>>")).toEqual(
      [
        { name: "a", type: "ARRAY<STRING>" },
        { name: "b", type: "OBJECT<x: STRING, y: BIGINT>" },
      ],
    );
  });

  it("returns empty for non-OBJECT inputs", () => {
    expect(parseVariantSchema("STRING")).toEqual([]);
    expect(parseVariantSchema("")).toEqual([]);
  });
});
