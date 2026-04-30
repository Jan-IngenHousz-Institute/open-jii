import nock from "nock";

import { TestHarness } from "../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../utils/fp-utils";
import { DeltaAdapter } from "./delta.adapter";

describe("DeltaAdapter", () => {
  const testApp = TestHarness.App;
  const deltaEndpoint = process.env.DELTA_ENDPOINT || "https://delta.example.com";
  const shareName = process.env.DELTA_SHARE_NAME || "open_jii_test";
  const schemaName = process.env.DELTA_SCHEMA_NAME || "centrum";

  let adapter: DeltaAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adapter = testApp.module.get(DeltaAdapter);
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** Build an NDJSON Delta Sharing query response with an empty schema. */
  const minimalNdjson = (
    files: { stats?: string; partitionValues?: Record<string, string> }[] = [],
  ): string => {
    const lines = [
      `{"protocol":{"minReaderVersion":1}}`,
      `{"metaData":{"id":"table-uuid","format":{"provider":"parquet"},"schemaString":"{\\"type\\":\\"struct\\",\\"fields\\":[]}","partitionColumns":[]}}`,
      ...files.map((f, i) =>
        JSON.stringify({
          file: {
            url: `https://example.com/file${i}.parquet`,
            id: `file${i}`,
            partitionValues: f.partitionValues ?? {},
            size: 1024,
            stats: f.stats,
          },
        }),
      ),
    ];
    return lines.join("\n");
  };

  describe("getTableData", () => {
    it("sends predicate hints derived from filters and forwards limit hint", async () => {
      const tableName = "enriched_experiment_macro_data";
      let receivedBody: { predicateHints?: string[]; limitHint?: number } = {};

      nock(deltaEndpoint)
        .post(
          `/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`,
          (body: { predicateHints?: string[]; limitHint?: number }) => {
            receivedBody = body;
            return true;
          },
        )
        .reply(200, minimalNdjson());

      const result = await adapter.getTableData(tableName, {
        filter: {
          op: "and",
          filters: [
            { op: "eq", column: "experiment_id", value: "exp-1" },
            { op: "eq", column: "macro_id", value: "macro-9" },
          ],
        },
        limitHint: 50,
      });

      assertSuccess(result);
      expect(receivedBody.predicateHints).toEqual([
        "`experiment_id` = 'exp-1'",
        "`macro_id` = 'macro-9'",
      ]);
      expect(receivedBody.limitHint).toBe(50);
    });

    it("escapes single quotes in filter values to prevent broken predicate strings", async () => {
      const tableName = "enriched_experiment_raw_data";
      let receivedBody: { predicateHints?: string[] } = {};

      nock(deltaEndpoint)
        .post(
          `/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`,
          (body: { predicateHints?: string[] }) => {
            receivedBody = body;
            return true;
          },
        )
        .reply(200, minimalNdjson());

      const result = await adapter.getTableData(tableName, {
        filter: { op: "eq", column: "experiment_id", value: "o'malley" },
      });

      assertSuccess(result);
      expect(receivedBody.predicateHints).toEqual(["`experiment_id` = 'o''malley'"]);
    });

    it("prunes files whose min/max stats prove the filter cannot match (no download attempted)", async () => {
      const tableName = "enriched_experiment_raw_data";

      const ndjson = minimalNdjson([
        // experiment_id range covers our id — should be downloaded
        {
          stats: JSON.stringify({
            numRecords: 10,
            minValues: { experiment_id: "exp-001" },
            maxValues: { experiment_id: "exp-999" },
          }),
        },
        // experiment_id range does NOT cover our id — should be pruned
        {
          stats: JSON.stringify({
            numRecords: 5,
            minValues: { experiment_id: "exp-aaa" },
            maxValues: { experiment_id: "exp-zzz" },
          }),
        },
      ]);

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`)
        .reply(200, ndjson);

      // Only the first file's URL is mocked. If the adapter tried to download
      // file1 too, nock would error.
      nock("https://example.com").get("/file0.parquet").reply(200, Buffer.from([]));

      const result = await adapter.getTableData(tableName, {
        filter: { op: "eq", column: "experiment_id", value: "exp-500" },
      });

      assertSuccess(result);
      expect(nock.pendingMocks()).toEqual([]);
    });

    it("keeps files that have no parsable stats (conservative pruning)", async () => {
      const tableName = "enriched_experiment_raw_data";

      const ndjson = minimalNdjson([{ stats: "not-json" }, { stats: undefined }]);

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`)
        .reply(200, ndjson);

      // Both files must be downloaded — stats can't prove they don't match.
      nock("https://example.com").get("/file0.parquet").reply(200, Buffer.from([]));
      nock("https://example.com").get("/file1.parquet").reply(200, Buffer.from([]));

      const result = await adapter.getTableData(tableName, {
        filter: { op: "eq", column: "experiment_id", value: "exp-1" },
      });

      assertSuccess(result);
      expect(nock.pendingMocks()).toEqual([]);
    });

    it("returns failure when the table query endpoint errors", async () => {
      const tableName = "nonexistent";

      nock(deltaEndpoint)
        .post(`/shares/${shareName}/schemas/${schemaName}/tables/${tableName}/query`)
        .reply(404, { errorCode: "TABLE_NOT_FOUND", message: "Table not found" });

      const result = await adapter.getTableData(tableName);

      assertFailure(result);
    });
  });

  describe("getExperimentTableMetadata", () => {
    /**
     * Mock the underlying getTableData call by intercepting the metadata table's
     * query endpoint. The adapter's metadata path goes through getTableData →
     * tablesService.queryTable, which we can stub via nock as the data path.
     *
     * For these tests we spy on getTableData directly to skip the parquet
     * decode dance — the row-shape mapping is what we want to verify.
     */
    it("maps snake_case row columns from the metadata table to camelCase port shape", async () => {
      vi.spyOn(adapter, "getTableData").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: {
          columns: [],
          rows: [
            {
              experiment_id: "exp-1",
              identifier: "raw_data",
              table_type: "static",
              row_count: 42,
              macro_schema: null,
              questions_schema: "OBJECT<q1: STRING>",
              custom_metadata_schema: null,
            },
          ],
          totalRows: 1,
          truncated: false,
        },
      } as never);

      const result = await adapter.getExperimentTableMetadata("exp-1");

      assertSuccess(result);
      expect(result.value).toEqual([
        {
          identifier: "raw_data",
          tableType: "static",
          rowCount: 42,
          macroSchema: null,
          questionsSchema: "OBJECT<q1: STRING>",
          customMetadataSchema: null,
        },
      ]);
    });

    it("omits schema fields when includeSchemas is false", async () => {
      vi.spyOn(adapter, "getTableData").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: {
          columns: [],
          rows: [
            {
              experiment_id: "exp-1",
              identifier: "raw_data",
              table_type: "static",
              row_count: 7,
              macro_schema: null,
              questions_schema: "OBJECT<q1: STRING>",
              custom_metadata_schema: "OBJECT<m: STRING>",
            },
          ],
          totalRows: 1,
          truncated: false,
        },
      } as never);

      const result = await adapter.getExperimentTableMetadata("exp-1", { includeSchemas: false });

      assertSuccess(result);
      expect(result.value[0]).toEqual({
        identifier: "raw_data",
        tableType: "static",
        rowCount: 7,
      });
    });

    it("forwards experiment_id and (optionally) identifier as an AND filter to getTableData", async () => {
      const dataSpy = vi.spyOn(adapter, "getTableData").mockResolvedValue({
        isSuccess: () => true,
        isFailure: () => false,
        value: { columns: [], rows: [], totalRows: 0, truncated: false },
      } as never);

      await adapter.getExperimentTableMetadata("exp-1", { identifier: "raw_data" });

      expect(dataSpy).toHaveBeenCalledWith("experiment_table_metadata", {
        filter: {
          op: "and",
          filters: [
            { op: "eq", column: "experiment_id", value: "exp-1" },
            { op: "eq", column: "identifier", value: "raw_data" },
          ],
        },
      });
    });
  });
});
