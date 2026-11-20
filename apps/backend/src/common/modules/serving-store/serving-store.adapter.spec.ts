import { createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { PAGE_BYTE_LIMIT } from "../../../experiments/core/models/experiment-data.model";
import type { StoreQueryParams } from "../../../experiments/core/ports/serving-store.port";
import { AppError, assertFailure, assertSuccess, failure, success } from "../../utils/fp-utils";
import type { FilterCondition } from "../databricks/services/query-builder/query-builder.types";
import { VariantSchema } from "../databricks/services/query-builder/schema/variant-schema";
import { ServingStoreClientService } from "./services/client/client.service";
import { ServingStoreConfigService } from "./services/config/config.service";
import { StoreQueryBuilder } from "./services/query-builder/store-query-builder";
import {
  MACRO_RESULTS_TABLE,
  MEASUREMENTS_TABLE,
  UPLOADS_TABLE,
} from "./services/query-builder/store-tables";
import { ServingStoreAdapter } from "./serving-store.adapter";

describe("ServingStoreAdapter", () => {
  let client: ServingStoreClientService;
  let adapter: ServingStoreAdapter;

  beforeEach(() => {
    client = new ServingStoreClientService(new ServingStoreConfigService(new ConfigService({})));
    adapter = new ServingStoreAdapter(client);
  });

  /** The store sends these rows, one at a time, for as long as the reader takes them; `handed`
   *  counts the rows it handed over. */
  function storeSends(rows: unknown[][]) {
    const sent = { handed: 0 };
    vi.spyOn(client, "stream").mockImplementation((_sql, take) => {
      const isComplete = rows.every((row) => {
        sent.handed += 1;
        return take(row);
      });
      return Promise.resolve(success({ complete: isComplete }));
    });
    return sent;
  }

  it("is not configured without a store", () => {
    expect(adapter.isConfigured()).toBe(false);
  });

  it("lists each table with its count and newest row, merging the schemas of its batches", async () => {
    const query = vi
      .spyOn(client, "query")
      .mockResolvedValueOnce(
        success({
          rows: [
            ["static", "raw_data", null, 3, "2026-09-14 17:06:42.965000"],
            ["macro", "m1", null, "2", null],
            ["upload", "t1", "plots", 1, "2026-09-01 10:00:00.000000"],
          ],
        }),
      )
      .mockResolvedValueOnce(
        success({
          rows: [
            ["macro", "m1", "macro_output", "OBJECT<a: BIGINT>"],
            ["macro", "m1", "macro_output", "OBJECT<a: DOUBLE, b: STRING>"],
            ["static", "raw_data", "questions_data", "OBJECT<plot: STRING>"],
            ["upload", "t1", "uploaded_data", "OBJECT<h: DOUBLE>"],
          ],
        }),
      );

    const result = await adapter.getExperimentTableMetadata("e1");

    assertSuccess(result);
    expect(query.mock.calls[0][0]).toContain("FROM experiment_measurements(experiment = 'e1')");
    expect(query.mock.calls[1][0]).toContain("FROM experiment_payload_schemas(experiment = 'e1')");
    const macroSchema = "OBJECT<a: DOUBLE, b: STRING>";
    expect(result.value).toEqual([
      expect.objectContaining({
        identifier: "raw_data",
        tableType: "static",
        rowCount: 3,
        latestRowAt: "2026-09-14T17:06:42.965Z",
        questionsSchema: "OBJECT<plot: STRING>",
        macroSchema: null,
      }),
      expect.objectContaining({
        identifier: "m1",
        tableType: "macro",
        rowCount: 2,
        latestRowAt: null,
        macroSchema,
        questionsSchema: null,
        schemaRevision: createHash("md5").update(`${macroSchema}|||`).digest("hex"),
      }),
      expect.objectContaining({
        identifier: "t1",
        tableType: "upload",
        displayName: "plots",
        uploadSchema: "OBJECT<h: DOUBLE>",
      }),
    ]);
  });

  it("lists an experiment's metadata sheets oldest first, for the tables whose rows take them", async () => {
    const query = vi.spyOn(client, "query").mockResolvedValue(
      success({
        rows: [
          ["s1", "plot", "OBJECT<area: DECIMAL(4,2)>", "3"],
          ["s2", "column:device_id", null, "5"],
        ],
      }),
    );

    const sheets = await adapter.getMetadataSheets("e1");

    assertSuccess(sheets);
    expect(sheets.value).toEqual([
      { id: "s1", matchOn: "plot", schema: "OBJECT<area: DECIMAL(4,2)>", version: "3" },
      { id: "s2", matchOn: "column:device_id", schema: null, version: "5" },
    ]);
    expect(query.mock.calls[0][0]).toContain(
      "FROM experiment_metadata_sheets(experiment = 'e1') ORDER BY sheet_created_at, sheet_id",
    );
    expect(adapter.takesCustomMetadata("upload", "t1")).toBe(false);
    expect(adapter.takesCustomMetadata("macro", "m1")).toBe(true);
  });

  it("passes on a failed listing", async () => {
    vi.spyOn(client, "query").mockResolvedValue(failure(AppError.internal("store down")));

    const result = await adapter.getExperimentTableMetadata("e1");

    assertFailure(result);
    expect(result.error.message).toBe("store down");
  });

  it("names and types a table's columns as the warehouse's view does", () => {
    const result = adapter.getExperimentTableColumns("upload", "t1");

    assertSuccess(result);
    expect(result.value.map(({ name }) => name)).toEqual([
      "id",
      "experiment_id",
      "upload_table_id",
      "upload_table_name",
      "upload_id",
      "uploaded_at",
      "uploaded_data",
      "contributor",
      "annotations",
      "custom_metadata",
    ]);
  });

  it("types a macro table's id as the warehouse's view casts it", async () => {
    const columns = adapter.getExperimentTableColumns("macro", "m1");
    assertSuccess(columns);
    const id = columns.value.filter(({ name }) => name === "id");
    storeSends([["12"]]);

    const result = await adapter.executeQuery({ sql: "SELECT id", columns: id });

    assertSuccess(result);
    expect(result.value.columns).toEqual([
      { name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 },
    ]);
  });

  it("holds no device table", () => {
    assertFailure(adapter.getExperimentTableColumns("static", "device"));
    assertFailure(
      adapter.buildExperimentQuery({
        tableName: "device",
        tableType: "static",
        experimentId: "e1",
      }),
    );
  });

  it.each([
    ["a column it does not have", "nope", 1],
    ["text that is no number for a number column", "id", "abc"],
  ])("answers %s as a bad request", (_, column, value) => {
    const result = adapter.buildExperimentQuery({
      tableName: "raw_data",
      tableType: "static",
      experimentId: "e1",
      filters: [{ column, operator: "equals", value }],
    });

    assertFailure(result);
    expect(result.error.code).toBe("INVALID_QUERY_INPUT");
  });

  it("writes rows as the warehouse writes its cells and leaves ids for the backend to fill", async () => {
    storeSends([
      ["1", "2026-09-14 16:56:31.972123", 3, "u1", '{"x":1}'],
      ["2", null, null, null, null],
    ]);

    const result = await adapter.executeQuery({
      sql: "SELECT …",
      columns: [
        { name: "id", type: "BIGINT" },
        { name: "timestamp", type: "TIMESTAMP" },
        { name: "latitude", type: "DOUBLE" },
        {
          name: "contributor",
          type: "STRUCT<id: STRING, name: STRING, avatar: STRING>",
          idOf: "contributor",
        },
        { name: "nested", type: "STRUCT<x: DOUBLE>" },
      ],
    });

    assertSuccess(result);
    expect(result.value.columns.map(({ type_name }) => type_name)).toEqual([
      "LONG",
      "TIMESTAMP",
      "DOUBLE",
      "STRUCT",
      "STRUCT",
    ]);
    expect(result.value.rows).toEqual([
      ["1", "2026-09-14T16:56:31.972Z", "3.0", "u1", '{"x":"1.0"}'],
      ["2", null, null, null, null],
    ]);
    expect(result.value).toMatchObject({ totalRows: 2, truncated: false });
  });

  it("writes each payload field's cell from the text the first of its columns carries", async () => {
    storeSends([['{"PAR":1.0E-7,"vH+":null}', null]]);

    const result = await adapter.executeQuery({
      sql: "SELECT …",
      columns: [
        { name: "vH+", type: "VARIANT", text: { column: "macro_output_text", key: "vH+" } },
        { name: "PAR", type: "DOUBLE", text: { column: "macro_output_text", key: "PAR" } },
      ],
    });

    assertSuccess(result);
    expect(result.value.rows).toEqual([["null", "1.0E-7"]]);
  });

  it("stops before the row that takes a read past the page limit and marks it truncated", async () => {
    const sent = storeSends([["a"], ["x".repeat(PAGE_BYTE_LIMIT)], ["c"]]);

    const result = await adapter.executeQuery({
      sql: "SELECT …",
      columns: [{ name: "device_name", type: "STRING" }],
    });

    assertSuccess(result);
    expect(result.value.rows).toEqual([["a"]]);
    expect(result.value.truncated).toBe(true);
    expect(sent.handed).toBe(2);
  });

  it("refuses a flagged read whose ids would pass the store's query size, before it reaches the store", () => {
    const flaggedRead = (rows: number) =>
      adapter.buildExperimentQuery({
        tableName: "raw_data",
        tableType: "static",
        experimentId: "e1",
        columns: ["id"],
        flagged: {
          kind: "only",
          addedRowIds: Array.from({ length: rows }, (_, index) => `${"r".repeat(58)}${index}`),
        },
      });

    assertSuccess(flaggedRead(1_000));
    const refused = flaggedRead(20_000);
    assertFailure(refused);
    expect(refused.error.code).toBe("FLAGGED_READ_TOO_LARGE");
  });

  it("counts a read as text", () => {
    const count = adapter.countQuery({ sql: "SELECT 1", columns: [] });

    expect(count).toEqual({
      sql: "SELECT toString(count()) AS total FROM (SELECT 1) AS sub",
      columns: [{ name: "total", type: "BIGINT" }],
    });
  });

  it("lists an experiment's contributor and client ids from their views", async () => {
    const query = vi.spyOn(client, "query").mockResolvedValue(success({ rows: [["u1"], ["u2"]] }));

    const contributors = await adapter.getExperimentIds("e1", "contributor");
    await adapter.getExperimentIds("e1", "device");

    assertSuccess(contributors);
    expect(contributors.value).toEqual(["u1", "u2"]);
    expect(query.mock.calls[0][0]).toBe(
      "SELECT user_id FROM experiment_contributor_ids(experiment = 'e1')",
    );
    expect(query.mock.calls[1][0]).toBe(
      "SELECT client_id FROM experiment_client_ids(experiment = 'e1')",
    );
  });
});

/**
 * The adapter's reads against a real store of the version the store runs, through the migrations'
 * views. It rebuilds the `store` database, so it runs only against a throwaway store, and skips
 * without one:
 *
 *   docker run -d --name feed-test-clickhouse -p 127.0.0.1:18123:8123 \
 *     -e CLICKHOUSE_USER=admin -e CLICKHOUSE_PASSWORD=local -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
 *     clickhouse/clickhouse-server:25.8.33.6
 *   CLICKHOUSE_TEST_URL=http://127.0.0.1:18123 CLICKHOUSE_TEST_USER=admin CLICKHOUSE_TEST_PASSWORD=local \
 *     pnpm --filter backend exec vitest run src/common/modules/serving-store
 */
const STORE_URL = process.env.CLICKHOUSE_TEST_URL;
const STORE_USER = process.env.CLICKHOUSE_TEST_USER ?? "default";
const STORE_PASSWORD = process.env.CLICKHOUSE_TEST_PASSWORD ?? "";

const MIGRATIONS = resolve(__dirname, "../../../../../../packages/database/clickhouse/migrations");

const EXPERIMENT = "e1";
const ADA = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f01";
const BEN = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f02";

const MEASUREMENTS = [
  {
    experiment_id: EXPERIMENT,
    id: 1,
    device_id: "d1",
    client_id: "thing-1",
    timestamp: "2026-09-14 16:56:31.972123",
    timezone: "America/Los_Angeles",
    macros: [{ id: "mac1", name: "Phi2", filename: "phi2.js" }],
    questions_data: { plot: "A1" },
    annotations: [],
    user_id: ADA,
    latitude: 52.1,
    data: '{"a":1}',
    processed_timestamp: "2026-09-14 17:06:42.965",
    _commit_version: 1,
    _commit_timestamp: "2026-09-14 17:07:00",
  },
  {
    experiment_id: EXPERIMENT,
    id: 2,
    device_id: "d2",
    client_id: "PST-client",
    timestamp: "2026-09-13 01:00:00",
    timezone: "PST",
    macros: [],
    questions_data: { plot: "B2" },
    annotations: [],
    user_id: BEN,
    latitude: 3,
    processed_timestamp: "2026-09-13 01:10:00",
    _commit_version: 1,
    _commit_timestamp: "2026-09-13 01:11:00",
  },
  {
    experiment_id: "other",
    id: 3,
    timestamp: "2026-09-13 01:00:00",
    questions_data: {},
    annotations: [],
    _commit_version: 1,
    _commit_timestamp: "2026-09-13 01:11:00",
  },
];

const MACRO_RESULTS = [
  {
    experiment_id: EXPERIMENT,
    id: 11,
    raw_id: 1,
    timestamp: "2026-09-14 16:56:31.972123",
    user_id: ADA,
    client_id: "thing-1",
    macro_id: "mac1",
    macro_output: {
      PAR: 1,
      order: ["red", "blue"],
      nested: { x: 1.5, y: "s" },
      user_id: "a field, not the column",
      "Plot no.": "P1",
    },
    macro_output_text:
      '{"PAR":1,"Plot no.":"P1","nested":{"x":1.5,"y":"s"},"order":["red","blue"],"user_id":"a field, not the column"}',
    questions_data: { plot: "A1" },
    annotations: [],
    _commit_version: 1,
    _commit_timestamp: "2026-09-14 17:07:00",
  },
  {
    experiment_id: EXPERIMENT,
    id: 12,
    raw_id: 2,
    timestamp: "2026-09-13 01:00:00",
    user_id: BEN,
    macro_id: "mac1",
    macro_output: { PAR: 0.0000001, order: [] },
    macro_output_text: '{"PAR":1.0E-7,"order":[]}',
    questions_data: {},
    annotations: [],
    _commit_version: 1,
    _commit_timestamp: "2026-09-13 01:11:00",
  },
  {
    experiment_id: EXPERIMENT,
    id: 13,
    raw_id: 1,
    timestamp: "2026-09-14 16:56:31.972123",
    macro_id: "mac2",
    macro_output: { _items: [{ k: 1 }, { k: 2.5, j: "x" }] },
    macro_output_text: '[{"k":1},{"j":"x","k":2.5}]',
    questions_data: {},
    annotations: [],
    _commit_version: 1,
    _commit_timestamp: "2026-09-14 17:07:00",
  },
];

const UPLOADS = [
  {
    experiment_id: EXPERIMENT,
    id: "9007199254740993",
    upload_table_id: "t1",
    upload_table_name: "first name",
    created_by: ADA,
    uploaded_at: "2026-09-01 10:00:00",
    uploaded_data: { "Plot no.": 7, h: 0.1 },
    uploaded_data_text: '{"Plot no.":7,"h":0.1}',
    _commit_version: 1,
    _commit_timestamp: "2026-09-01 10:00:01",
  },
  {
    experiment_id: EXPERIMENT,
    id: 5,
    upload_table_id: "t1",
    upload_table_name: "renamed",
    created_by: ADA,
    uploaded_at: "2026-09-02 10:00:00",
    uploaded_data: { "Plot no.": 8, h: 1000 },
    uploaded_data_text: '{"Plot no.":8,"h":1000}',
    _commit_version: 1,
    _commit_timestamp: "2026-09-02 10:00:01",
  },
];

// Two feed batches of mac1, which the listing merges into one schema.
const PAYLOAD_SCHEMAS = [
  ["static", "raw_data", "questions_data", "OBJECT<plot: STRING>"],
  [
    "macro",
    "mac1",
    "macro_output",
    "OBJECT<PAR: BIGINT, `Plot no.`: STRING, nested: OBJECT<x: DOUBLE, y: STRING>, order: ARRAY<STRING>, user_id: STRING>",
  ],
  ["macro", "mac1", "macro_output", "OBJECT<PAR: DOUBLE, order: ARRAY<VOID>>"],
  ["macro", "mac1", "questions_data", "OBJECT<plot: STRING>"],
  ["macro", "mac2", "macro_output", "ARRAY<OBJECT<j: STRING, k: DOUBLE>>"],
  ["upload", "t1", "uploaded_data", "OBJECT<`Plot no.`: BIGINT, h: DOUBLE>"],
].map(([table_type, identifier, payload, schema]) => ({
  experiment_id: EXPERIMENT,
  table_type,
  identifier,
  payload,
  schema,
  _commit_version: 1,
}));

describe.skipIf(STORE_URL === undefined)("ServingStoreAdapter against a store", () => {
  let admin: ClickHouseClient;
  let client: ServingStoreClientService;
  let adapter: ServingStoreAdapter;

  beforeAll(async () => {
    const url = STORE_URL ?? "";
    const server = createClient({ url, username: STORE_USER, password: STORE_PASSWORD });
    await server.command({ query: "DROP DATABASE IF EXISTS store SYNC" });
    await server.command({ query: "CREATE DATABASE store" });
    await server.close();

    admin = createClient({
      url,
      username: STORE_USER,
      password: STORE_PASSWORD,
      database: "store",
      clickhouse_settings: { json_type_escape_dots_in_keys: 1 },
    });
    for (const statement of migrationStatements()) {
      await admin.command({ query: statement });
    }
    await admin.insert({ table: "measurements", values: MEASUREMENTS, format: "JSONEachRow" });
    await admin.insert({ table: "macro_results", values: MACRO_RESULTS, format: "JSONEachRow" });
    await admin.insert({ table: "uploads", values: UPLOADS, format: "JSONEachRow" });
    await admin.insert({
      table: "payload_schemas",
      values: PAYLOAD_SCHEMAS,
      format: "JSONEachRow",
    });

    const config = new ConfigService({
      servingStore: { url, username: STORE_USER, password: STORE_PASSWORD },
    });
    client = new ServingStoreClientService(new ServingStoreConfigService(config));
    adapter = new ServingStoreAdapter(client);
  });

  afterAll(async () => {
    await client.onModuleDestroy();
    await admin.close();
  });

  async function rowsOf(params: Parameters<ServingStoreAdapter["buildExperimentQuery"]>[0]) {
    const query = adapter.buildExperimentQuery(params);
    assertSuccess(query);
    const data = await adapter.executeQuery(query.value);
    assertSuccess(data);
    return data.value;
  }

  it("answers a failed read without its statement or the values in it", async () => {
    const result = await client.query(
      "SELECT missing_column FROM numbers(1) WHERE 'a-value-in-the-read' != ''",
    );

    assertFailure(result);
    expect(result.error.code).toBe("SERVING_STORE_QUERY_FAILED");
    expect(result.error.message).not.toContain("a-value-in-the-read");
    expect(result.error.message).not.toContain("missing_column");
  });

  it("lists the experiment's tables with their counts, newest rows and merged schemas", async () => {
    const result = await adapter.getExperimentTableMetadata(EXPERIMENT);
    assertSuccess(result);

    const tables = new Map(result.value.map((table) => [table.identifier, table]));
    expect([...tables.keys()].sort()).toEqual(["mac1", "mac2", "raw_data", "t1"]);

    const macro = tables.get("mac1");
    const macroSchema = VariantSchema.merge([PAYLOAD_SCHEMAS[1].schema, PAYLOAD_SCHEMAS[2].schema]);
    expect(macro).toMatchObject({ tableType: "macro", rowCount: 2, macroSchema });
    expect(macro?.macroSchema).toContain("PAR: DOUBLE");
    const fingerprint = `${macroSchema ?? ""}|OBJECT<plot: STRING>||`;
    expect(macro?.schemaRevision).toBe(createHash("md5").update(fingerprint).digest("hex"));

    expect(tables.get("raw_data")).toMatchObject({
      tableType: "static",
      rowCount: 2,
      latestRowAt: "2026-09-14T17:06:42.965Z",
      questionsSchema: "OBJECT<plot: STRING>",
    });
    expect(tables.get("t1")).toMatchObject({
      tableType: "upload",
      displayName: "renamed",
      rowCount: 2,
      latestRowAt: "2026-09-02T10:00:00.000Z",
    });
  });

  it("reads a page in the warehouse's columns and cell text", async () => {
    const data = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: EXPERIMENT,
      variants: [
        { columnName: "questions_data", schema: "OBJECT<plot: STRING>", suffix: "answer" },
      ],
      exceptColumns: ["experiment_id", "custom_metadata"],
      ordering: { column: "timestamp", direction: "DESC" },
      limit: 5,
    });

    const names = data.columns.map(({ name }) => name);
    expect(names).toEqual([
      "id",
      "device_id",
      "device_name",
      "timestamp",
      "measurement_time_utc",
      "timezone",
      "date",
      "macros",
      "contributor",
      "device",
      "protocol_id",
      "workbook_run_id",
      "latitude",
      "longitude",
      "data",
      "processed_timestamp",
      "measurement_time_local",
      "local_time",
      "annotations",
      "plot",
    ]);

    const first = Object.fromEntries(names.map((name, index) => [name, data.rows[0][index]]));
    expect(first).toMatchObject({
      id: "1",
      timestamp: "2026-09-14T16:56:31.972Z",
      date: "2026-09-14",
      macros: '[{"id":"mac1","name":"Phi2","filename":"phi2.js"}]',
      contributor: ADA,
      device: '["thing-1","thing-1 (d1)"]',
      latitude: "52.1",
      data: '{"a":1}',
      measurement_time_local: "2026-09-14 09:56:31",
      local_time: "09:56",
      annotations: "[]",
      plot: "A1",
    });

    const second = Object.fromEntries(names.map((name, index) => [name, data.rows[1][index]]));
    // A zone Spark accepts and the store does not know reads as no local time, not a failed read.
    expect(second).toMatchObject({ latitude: "3.0", measurement_time_local: null });
  });

  it("returns a sorted page's own rows, each in its newest copy", async () => {
    const row = {
      experiment_id: "e2",
      device_id: "d1",
      _commit_version: 1,
      _commit_timestamp: "2026-10-01 08:00:01",
    };
    const rows = [
      { ...row, id: 5, device_name: "oldest", timestamp: "2026-09-29 08:00:00" },
      { ...row, id: 6, device_name: "first", timestamp: "2026-09-30 08:00:00" },
      { ...row, id: 7, device_name: "newest", timestamp: "2026-10-01 08:00:00" },
    ];
    const copy = { ...rows[1], device_name: "second", _commit_version: 2 };
    // A separate insert puts the copy in its own part, so the read itself has to merge it.
    await admin.insert({ table: "measurements", values: rows, format: "JSONEachRow" });
    await admin.insert({ table: "measurements", values: [copy], format: "JSONEachRow" });

    const page = (offset: number) =>
      rowsOf({
        tableName: "raw_data",
        tableType: "static",
        experimentId: "e2",
        columns: ["id", "device_name"],
        ordering: { column: "timestamp", direction: "DESC" },
        limit: 1,
        offset,
      });

    expect((await page(0)).rows).toEqual([["7", "newest"]]);
    expect((await page(1)).rows).toEqual([["6", "second"]]);
    expect((await page(2)).rows).toEqual([["5", "oldest"]]);
  });

  it("pages through rows that share a sort value, each on exactly one page", async () => {
    const row = {
      experiment_id: "e3",
      device_id: "d1",
      device_name: "Same name",
      _commit_version: 1,
      _commit_timestamp: "2026-10-01 08:00:01",
    };
    await admin.insert({
      table: "measurements",
      values: [
        { ...row, id: 21, timestamp: "2026-10-01 08:00:00" },
        { ...row, id: 22, timestamp: "2026-09-30 08:00:00" },
        { ...row, id: 23, timestamp: "2026-09-29 08:00:00" },
      ],
      format: "JSONEachRow",
    });

    const page = async (offset: number) =>
      (
        await rowsOf({
          tableName: "raw_data",
          tableType: "static",
          experimentId: "e3",
          columns: ["id"],
          ordering: { column: "device_name", direction: "ASC" },
          limit: 1,
          offset,
        })
      ).rows;

    // Equal names fall back to the store's key, which starts with the time.
    expect([...(await page(0)), ...(await page(1)), ...(await page(2))]).toEqual([
      ["23"],
      ["22"],
      ["21"],
    ]);
  });

  it("flattens payload fields by type and keeps a field named like a column apart from it", async () => {
    const macroSchema = VariantSchema.merge([PAYLOAD_SCHEMAS[1].schema, PAYLOAD_SCHEMAS[2].schema]);
    const data = await rowsOf({
      tableName: "mac1",
      tableType: "macro",
      experimentId: EXPERIMENT,
      variants: [{ columnName: "macro_output", schema: macroSchema ?? "", suffix: "output" }],
      columns: ["id", "contributor", "PAR", "Plot no.", "nested", "order", "user_id"],
      ordering: { column: "PAR", direction: "ASC" },
    });

    expect(data.columns.map(({ type_text }) => type_text)).toEqual([
      "BIGINT",
      "STRUCT<id: STRING, name: STRING, avatar: STRING>",
      "DOUBLE",
      "STRING",
      "STRUCT<x: DOUBLE, y: STRING>",
      "ARRAY<STRING>",
      "STRING",
    ]);
    expect(data.rows).toEqual([
      ["12", BEN, "1.0E-7", null, null, "[]", null],
      ["11", ADA, "1.0", "P1", '{"x":"1.5","y":"s"}', '["red","blue"]', "a field, not the column"],
    ]);
  });

  it("shows a macro's fields from its text as Spark wrote it, a null one apart from a missing one", async () => {
    // Each output as the feed sends it: the JSON column's value, which the store reprints and
    // drops null keys from, and Spark's text of gold's VARIANT. Then the cell the warehouse shows.
    const outputs: [Record<string, unknown>, string, string | null][] = [
      [{ "vH+": -0.00000289 }, '{"vH+":-2.89E-6}', "-2.89E-6"],
      [{ "vH+": 0.00000289 }, '{"vH+":0.00000289}', "0.00000289"],
      [{ "vH+": null }, '{"vH+":null}', "null"],
      [{}, "{}", null],
      [
        { "vH+": 1.2345678901234568e29 },
        '{"vH+":123456789012345678901234567890}',
        "123456789012345678901234567890",
      ],
      [{ "vH+": "NA" }, '{"vH+":"NA"}', '"NA"'],
    ];
    await admin.insert({
      table: "macro_results",
      values: outputs.map(([output, text], index) => ({
        experiment_id: "macro-numbers",
        id: 300 + index,
        raw_id: 300 + index,
        timestamp: "2026-09-13 01:00:00",
        macro_id: "mac3",
        macro_output: output,
        macro_output_text: text,
        questions_data: {},
        annotations: [],
        _commit_version: 1,
        _commit_timestamp: "2026-09-13 01:11:00",
      })),
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      tableName: "mac3",
      tableType: "macro",
      experimentId: "macro-numbers",
      variants: [
        { columnName: "macro_output", schema: "OBJECT<`vH+`: VARIANT>", suffix: "output" },
      ],
      columns: ["id", "vH+"],
      ordering: { column: "id" },
    });

    expect(data.rows.map(([, cell]) => cell)).toEqual(outputs.map(([, , cell]) => cell));
  });

  it("shows an upload's doubles as Spark wrote them, which a parquet upload writes in Java's form", async () => {
    await admin.insert({
      table: "uploads",
      values: [
        {
          experiment_id: "parquet",
          id: 1,
          upload_table_id: "t3",
          uploaded_at: "2026-09-01 10:00:00",
          uploaded_data: { ph: 0.00015, n: 12345678 },
          uploaded_data_text: '{"n":1.2345678E7,"ph":1.5E-4}',
          _commit_version: 1,
          _commit_timestamp: "2026-09-01 10:00:01",
        },
      ],
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      tableName: "t3",
      tableType: "upload",
      experimentId: "parquet",
      variants: [
        {
          columnName: "uploaded_data",
          schema: "OBJECT<n: VARIANT, ph: VARIANT>",
          suffix: "upload",
        },
      ],
      columns: ["ph", "n"],
    });

    expect(data.rows).toEqual([["1.5E-4", "1.2345678E7"]]);
  });

  it("reads a payload that is no object whole", async () => {
    const data = await rowsOf({
      tableName: "mac2",
      tableType: "macro",
      experimentId: EXPERIMENT,
      variants: [
        {
          columnName: "macro_output",
          schema: "ARRAY<OBJECT<j: STRING, k: DOUBLE>>",
          suffix: "output",
        },
      ],
      columns: ["macro_output"],
    });

    expect(data.rows).toEqual([['[{"j":null,"k":"1.0"},{"j":"x","k":"2.5"}]']]);
  });

  it("filters times given as ISO text, and text columns by numbers", async () => {
    const data = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: EXPERIMENT,
      columns: ["id"],
      filters: [
        { column: "timestamp", operator: "greater_than", value: "2026-09-14T00:00:00.000Z" },
        { column: "device_id", operator: "not_equals", value: 7 },
        { column: "contributor.id", operator: "in", value: [ADA, BEN] },
      ],
    });

    expect(data.rows).toEqual([["1"]]);
  });

  it("sorts by the ids a name sort orders, and by the pseudonym an anonymized experiment shows", async () => {
    const byName = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: EXPERIMENT,
      columns: ["id"],
      ordering: { column: "contributor.name", direction: "ASC" },
      orderByIds: [BEN, ADA],
    });
    expect(byName.rows).toEqual([["2"], ["1"]]);

    const pseudonym = (id: string) =>
      `Contributor-${createHash("sha256").update(`${EXPERIMENT}:${id}`).digest("hex").slice(0, 6).toUpperCase()}`;
    const expected = [ADA, BEN].sort((a, b) => (pseudonym(a) < pseudonym(b) ? -1 : 1));
    const byPseudonym = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: EXPERIMENT,
      columns: ["contributor"],
      ordering: {
        column: "contributor.id",
        direction: "ASC",
        mode: { kind: "pseudonym", salt: EXPERIMENT },
      },
    });
    expect(byPseudonym.rows).toEqual(expected.map((id) => [id]));
  });

  it("gives the anonymizer's pinned pair the pseudonym the anonymizer gives it", async () => {
    const builder = new StoreQueryBuilder();
    const pseudonym = builder.contributorPseudonym(
      builder.escapeValue(ADA),
      "5f3c1b9e-2a47-4d6b-9e1f-7a8c0d2b4e61",
    );

    const result = await client.query(`SELECT ${pseudonym}`);

    assertSuccess(result);
    expect(result.value.rows).toEqual([["Contributor-AC2F1B"]]);
  });

  it("sorts text answers by the number they hold, then text, then empty ones, as the warehouse does", async () => {
    const answers = ["10", "9", "abc", "", " 2.5 ", "+1"];
    await admin.insert({
      table: "measurements",
      values: answers.map((plot, index) => ({
        experiment_id: "numbers",
        id: 100 + index,
        timestamp: "2026-09-13 01:00:00",
        questions_data: { plot },
        annotations: [],
        _commit_version: 1,
        _commit_timestamp: "2026-09-13 01:11:00",
      })),
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: "numbers",
      variants: [
        { columnName: "questions_data", schema: "OBJECT<plot: STRING>", suffix: "answer" },
      ],
      columns: ["plot"],
      ordering: {
        column: "plot",
        direction: "ASC",
        mode: { kind: "numericString", rowId: "id" },
      },
    });

    expect(data.rows).toEqual([["+1"], [" 2.5 "], ["9"], ["10"], ["abc"], [""]]);
  });

  describe("Number question answers", () => {
    // Each answer with the double Spark's cast reads it as on the warehouse.
    const answers: [string, string | null][] = [
      ["20", "20.0"],
      ["10", "10.0"],
      ["abc", null],
      ["", null],
      [" 10 ", "10.0"],
      ["10d", "10.0"],
      ["1e3", "1000.0"],
      ["51.986383", "51.986383"],
    ];
    const read = {
      tableName: "raw_data",
      tableType: "static",
      experimentId: "number-answers",
      variants: [
        {
          columnName: "questions_data",
          schema: "OBJECT<height: DOUBLE, plot: STRING>",
          suffix: "answer",
        },
      ],
    } satisfies Parameters<ServingStoreAdapter["buildExperimentQuery"]>[0];

    beforeAll(async () => {
      await admin.insert({
        table: "measurements",
        values: answers.map(([height], index) => ({
          experiment_id: "number-answers",
          id: 200 + index,
          timestamp: "2026-09-13 01:00:00",
          questions_data: { height, plot: "007" },
          annotations: [],
          _commit_version: 1,
          _commit_timestamp: "2026-09-13 01:11:00",
        })),
        format: "JSONEachRow",
      });
    });

    it("reads each answer as Spark casts its text, and one that holds no number as null", async () => {
      const data = await rowsOf({ ...read, columns: ["id", "height"], ordering: { column: "id" } });

      expect(data.columns[1].type_text).toBe("DOUBLE");
      expect(data.rows.map(([, height]) => height)).toEqual(answers.map(([, cell]) => cell));
    });

    it("sorts answers by value, empty ones last both ways and the row id breaking ties", async () => {
      const sorted = async (direction: "ASC" | "DESC") =>
        (
          await rowsOf({
            ...read,
            columns: ["id"],
            ordering: { column: "height", direction, mode: { kind: "number", rowId: "id" } },
            limit: 8,
          })
        ).rows.map(([id]) => id);

      expect(await sorted("ASC")).toEqual(["201", "204", "205", "200", "207", "206", "202", "203"]);
      expect(await sorted("DESC")).toEqual([
        "206",
        "207",
        "200",
        "201",
        "204",
        "205",
        "202",
        "203",
      ]);
    });

    it("matches no row for text that holds no number, and compares text that does", async () => {
      const ids = async (filters: FilterCondition[]) =>
        (await rowsOf({ ...read, columns: ["id"], filters, ordering: { column: "id" } })).rows;

      expect(await ids([{ column: "height", operator: "equals", value: "n/a" }])).toEqual([]);
      expect(await ids([{ column: "height", operator: "in", value: ["10", ""] }])).toEqual([
        ["201"],
        ["204"],
        ["205"],
      ]);
      expect(await ids([{ column: "height", operator: "greater_than", value: 50 }])).toEqual([
        ["206"],
        ["207"],
      ]);
      expect(await ids([{ column: "plot", operator: "equals", value: "007" }])).toHaveLength(8);
    });

    it("reads an answer of no finite number as Spark does, not as no value", async () => {
      const unbounded: [string, string][] = [
        ["NaN", "NaN"],
        ["Infinity", "Infinity"],
        ["-inf", "-Infinity"],
        ["1e400", "Infinity"],
      ];
      await admin.insert({
        table: "measurements",
        values: unbounded.map(([height], index) => ({
          experiment_id: "unbounded-answers",
          id: 220 + index,
          timestamp: "2026-09-13 01:00:00",
          questions_data: { height },
          annotations: [],
          _commit_version: 1,
          _commit_timestamp: "2026-09-13 01:11:00",
        })),
        format: "JSONEachRow",
      });

      const data = await rowsOf({
        ...read,
        experimentId: "unbounded-answers",
        columns: ["height"],
        ordering: { column: "id" },
      });

      expect(data.rows).toEqual(unbounded.map(([, cell]) => [cell]));
    });

    it("sorts an answer of NaN above every number both ways, as Spark does", async () => {
      await admin.insert({
        table: "measurements",
        values: ["1", "NaN", "", "5"].map((height, index) => ({
          experiment_id: "nan-answers",
          id: 230 + index,
          timestamp: "2026-09-13 01:00:00",
          questions_data: { height },
          annotations: [],
          _commit_version: 1,
          _commit_timestamp: "2026-09-13 01:11:00",
        })),
        format: "JSONEachRow",
      });
      const sorted = async (direction: "ASC" | "DESC") =>
        (
          await rowsOf({
            ...read,
            experimentId: "nan-answers",
            columns: ["id"],
            ordering: { column: "height", direction, mode: { kind: "number", rowId: "id" } },
          })
        ).rows.map(([id]) => id);

      expect(await sorted("ASC")).toEqual(["230", "233", "231", "232"]);
      expect(await sorted("DESC")).toEqual(["231", "233", "230", "232"]);
    });
  });

  it("filters and sorts devices by the serial numbers it is given", async () => {
    const data = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: EXPERIMENT,
      columns: ["id"],
      filters: [{ column: "device.serial_number", operator: "contains", value: "SN" }],
      ordering: { column: "device.serial_number", direction: "DESC" },
      deviceSerials: [
        ["thing-1", "SN-1"],
        ["PST-client", "SN-2"],
      ],
    });

    expect(data.rows).toEqual([["2"], ["1"]]);
  });

  describe("device labels", () => {
    // The rows the warehouse's device-label Spark test reads, with the same registry serials.
    const devices: [number, string | null, string | null, string | null][] = [
      [1, "c1", "d1", "MultispeQ"],
      [2, "c9", "d2", "Ambit"],
      [3, "c9", "d3", "Ambit"],
      [4, "phone-1", "d4", " "],
      [5, null, "imported-1", null],
      [6, "phone-1", null, "Probe"],
      [7, " ", " ", " "],
      [8, null, null, " Bench "],
      [9, "blank-phone", "blank", "Probe"],
      [10, "phone-only", null, null],
      [11, "c1", "other-sensor", "MultispeQ"],
    ];
    const serials: [string, string][] = [
      ["c1", " SN1 "],
      ["blank-phone", " "],
    ];
    const read: Pick<StoreQueryParams, "tableName" | "tableType" | "experimentId"> = {
      tableName: "raw_data",
      tableType: "static",
      experimentId: "devices",
    };

    beforeAll(async () => {
      await admin.insert({
        table: "measurements",
        values: devices.map(([id, client_id, device_id, device_name]) => ({
          experiment_id: "devices",
          id,
          client_id,
          device_id,
          device_name,
          timestamp: "2026-09-13 01:00:00",
          questions_data: {},
          annotations: [],
          _commit_version: 1,
          _commit_timestamp: "2026-09-13 01:11:00",
        })),
        format: "JSONEachRow",
      });
    });

    it("labels each device as the warehouse does", async () => {
      const data = await rowsOf({
        ...read,
        columns: ["id", "device.serial_number", "device"],
        deviceSerials: serials,
        ordering: { column: "id" },
      });

      expect(data.rows.map(([, label]) => label)).toEqual([
        " SN1 ",
        "Ambit (d2)",
        "Ambit (d3)",
        "phone-1 (d4)",
        "imported-1",
        "Probe (phone-1)",
        null,
        "Bench",
        "Probe (blank)",
        "phone-only",
        " SN1 ",
      ]);
      // The device itself comes back as its client id and its label, for the backend to finish.
      expect(data.rows[1][2]).toBe('["c9","Ambit (d2)"]');
      expect(data.rows[4][2]).toBe('[null,"imported-1"]');
    });

    it("filters and sorts by the label", async () => {
      const filtered = await rowsOf({
        ...read,
        columns: ["id"],
        filters: [{ column: "device.serial_number", operator: "equals", value: "Ambit (d2)" }],
        deviceSerials: serials,
      });
      expect(filtered.rows).toEqual([["2"]]);

      // A page, so the serials are read inside the statement that picks its keys too.
      const sorted = await rowsOf({
        ...read,
        columns: ["id"],
        ordering: { column: "device.serial_number" },
        deviceSerials: serials,
        limit: 3,
      });
      // No label sorts first, then the two rows of the registered device.
      expect(sorted.rows[0]).toEqual(["7"]);
      expect(sorted.rows.slice(1, 3).sort()).toEqual([["1"], ["11"]]);
    });

    // Rows 1 and 11 are one registered device, so either may come first.
    const wholeDeviceSorts: { direction: "ASC" | "DESC"; order: string[] }[] = [
      { direction: "ASC", order: ["7", "2", "3", "8", "6", "5", "4", "10", "1", "1", "9"] },
      { direction: "DESC", order: ["9", "1", "1", "10", "4", "5", "6", "8", "3", "2", "7"] },
    ];

    it.each(wholeDeviceSorts)(
      "sorts whole devices $direction by registry order, the unregistered by their labels",
      async ({ direction, order }) => {
        const sorted = await rowsOf({
          ...read,
          columns: ["id"],
          ordering: { column: "device", direction },
          orderByIds: ["c1", "blank-phone"],
          deviceSerials: serials,
          limit: 11,
        });

        expect(sorted.rows.map(([id]) => (id === "11" ? "1" : id))).toEqual(order);
      },
    );

    it("lists the labels as the device picker pages them", async () => {
      const labels = async (limit: number, offset: number) => {
        const projected = adapter.buildExperimentQuery({
          ...read,
          columns: ["device.serial_number"],
          deviceSerials: serials,
        });
        assertSuccess(projected);
        const data = await adapter.executeQuery(
          adapter.deviceLabelsQuery(projected.value, limit, offset),
        );
        assertSuccess(data);
        return data.value.rows.map(([label]) => label);
      };

      expect(await labels(1001, 0)).toEqual([
        " SN1 ",
        "Ambit (d2)",
        "Ambit (d3)",
        "Bench",
        "imported-1",
        "phone-1 (d4)",
        "phone-only",
        "Probe (blank)",
        "Probe (phone-1)",
      ]);
      expect(await labels(3, 3)).toEqual(["Bench", "imported-1", "phone-1 (d4)"]);
    });
  });

  it("keeps ids past 2^53 and names a table by its newest upload", async () => {
    const data = await rowsOf({
      tableName: "t1",
      tableType: "upload",
      experimentId: EXPERIMENT,
      variants: [
        {
          columnName: "uploaded_data",
          schema: "OBJECT<`Plot no.`: BIGINT, h: DOUBLE>",
          suffix: "upload",
        },
      ],
      columns: ["id", "Plot no.", "h"],
      ordering: { column: "uploaded_at" },
    });

    expect(data.rows).toEqual([
      ["9007199254740993", "7", "0.1"],
      ["5", "8", "1000.0"],
    ]);
  });

  it("compares a payload's integer past 2^53 with text as two doubles, as Spark does", async () => {
    // Raw text, since a JavaScript number cannot hold 2^53 + 1.
    const row = (id: number, plot: string) =>
      `{"experiment_id":"big-plots","id":${id},"upload_table_id":"t3","uploaded_at":"2026-09-03 10:00:00",` +
      `"uploaded_data":{"plot":${plot}},"uploaded_data_text":${JSON.stringify(`{"plot":${plot}}`)},` +
      `"_commit_version":1,"_commit_timestamp":"2026-09-03 10:00:01"}`;
    await admin.command({
      query: `INSERT INTO uploads FORMAT JSONEachRow ${row(1, "9007199254740992")} ${row(2, "9007199254740993")}`,
    });
    const ids = async (filters: FilterCondition[]) =>
      (
        await rowsOf({
          tableName: "t3",
          tableType: "upload",
          experimentId: "big-plots",
          variants: [
            { columnName: "uploaded_data", schema: "OBJECT<plot: BIGINT>", suffix: "upload" },
          ],
          columns: ["id"],
          filters,
          ordering: { column: "id" },
        })
      ).rows;

    const text = "9007199254740993";
    expect(await ids([{ column: "plot", operator: "equals", value: text }])).toEqual([
      ["1"],
      ["2"],
    ]);
    expect(await ids([{ column: "plot", operator: "in", value: [text] }])).toEqual([["1"], ["2"]]);
  });

  it("sorts a double field with NaN above every number, its distinct values too", async () => {
    const values: (number | string | undefined)[] = [1.5, "NaN", undefined, 3];
    await admin.insert({
      table: "uploads",
      values: values.map((h, index) => ({
        experiment_id: "nan-uploads",
        id: index + 1,
        upload_table_id: "t4",
        uploaded_at: "2026-09-04 10:00:00",
        uploaded_data: h === undefined ? {} : { h },
        uploaded_data_text: JSON.stringify(h === undefined ? {} : { h }),
        _commit_version: 1,
        _commit_timestamp: "2026-09-04 10:00:01",
      })),
      format: "JSONEachRow",
    });
    const read = {
      tableName: "t4",
      tableType: "upload",
      experimentId: "nan-uploads",
      variants: [{ columnName: "uploaded_data", schema: "OBJECT<h: DOUBLE>", suffix: "upload" }],
    } satisfies Parameters<ServingStoreAdapter["buildExperimentQuery"]>[0];
    const sorted = async (direction: "ASC" | "DESC") =>
      (await rowsOf({ ...read, columns: ["id"], ordering: { column: "h", direction } })).rows;

    expect(await sorted("ASC")).toEqual([["3"], ["1"], ["4"], ["2"]]);
    expect(await sorted("DESC")).toEqual([["2"], ["4"], ["1"], ["3"]]);
    const distinct = await rowsOf({
      ...read,
      columns: ["h"],
      distinct: true,
      ordering: { column: "h", direction: "DESC" },
    });
    expect(distinct.rows).toEqual([["NaN"], ["3.0"], ["1.5"], [null]]);
  });

  it("reads a key that ends in a backslash, and a missing array as null", async () => {
    await admin.insert({
      table: "uploads",
      values: [
        {
          experiment_id: "e2",
          id: 1,
          upload_table_id: "t2",
          uploaded_at: "2026-09-01 10:00:00",
          uploaded_data: { "Temp\\": 1, order: ["a"] },
          uploaded_data_text: JSON.stringify({ "Temp\\": 1, order: ["a"] }),
          _commit_version: 1,
          _commit_timestamp: "2026-09-01 10:00:01",
        },
        {
          experiment_id: "e2",
          id: 2,
          upload_table_id: "t2",
          uploaded_at: "2026-09-02 10:00:00",
          uploaded_data: { "Temp\\": 2 },
          uploaded_data_text: JSON.stringify({ "Temp\\": 2 }),
          _commit_version: 1,
          _commit_timestamp: "2026-09-02 10:00:01",
        },
      ],
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      tableName: "t2",
      tableType: "upload",
      experimentId: "e2",
      variants: [
        {
          columnName: "uploaded_data",
          schema: "OBJECT<`Temp\\`: BIGINT, order: ARRAY<STRING>>",
          suffix: "upload",
        },
      ],
      columns: ["Temp\\", "order"],
      ordering: { column: "uploaded_at" },
    });

    expect(data.rows).toEqual([
      ["1", '["a"]'],
      ["2", null],
    ]);
  });

  it("serves a read the store holds in more than 25 MiB when its cells, as text, hold less", async () => {
    // Four null text cells take 36 bytes a row in the store's memory and 22 as JSON text.
    await admin.command({
      query: `INSERT INTO measurements (experiment_id, id, timestamp, questions_data, annotations, _commit_version, _commit_timestamp)
        SELECT 'big-page', number, toDateTime64('2026-09-13 01:00:00', 6, 'UTC'), map(), [], 1, toDateTime64('2026-09-13 01:11:00', 6, 'UTC')
        FROM numbers(800000)`,
    });

    const data = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: "big-page",
      columns: ["device_id", "device_name", "protocol_id", "workbook_run_id"],
    });

    expect(data.rows).toHaveLength(800_000);
    expect(data.truncated).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(data.rows))).toBeLessThan(PAGE_BYTE_LIMIT);
  });

  it("stops reading a page before the row that takes its cells past the read limit", async () => {
    // Rows of a million bytes each, 40 MB in all and well under the store's own guard.
    await admin.command({
      query: `INSERT INTO measurements (experiment_id, id, timestamp, device_name, questions_data, annotations, _commit_version, _commit_timestamp)
        SELECT 'wide-page', number, toDateTime64('2026-09-13 01:00:00', 6, 'UTC'), repeat('x', 1000000), map(), [], 1, toDateTime64('2026-09-13 01:11:00', 6, 'UTC')
        FROM numbers(40)`,
    });

    const data = await rowsOf({
      tableName: "raw_data",
      tableType: "static",
      experimentId: "wide-page",
      columns: ["device_name"],
    });

    // 26 rows of 1,000,004 bytes and their separators fit 25 MiB; the 27th passes it.
    expect(data.truncated).toBe(true);
    expect(data.rows).toHaveLength(26);
  });

  it("counts a read and lists the experiment's ids", async () => {
    const query = adapter.buildExperimentQuery({
      tableName: "raw_data",
      tableType: "static",
      experimentId: EXPERIMENT,
    });
    assertSuccess(query);
    const count = await adapter.executeQuery(adapter.countQuery(query.value));
    assertSuccess(count);
    expect(count.value.rows).toEqual([["2"]]);

    const contributors = await adapter.getExperimentIds(EXPERIMENT, "contributor");
    const devices = await adapter.getExperimentIds(EXPERIMENT, "device");
    assertSuccess(contributors);
    assertSuccess(devices);
    expect(contributors.value.sort()).toEqual([ADA, BEN]);
    expect(devices.value.sort()).toEqual(["PST-client", "thing-1"]);
  });

  it("filters a page by its rows' flags, the phone's and those added afterwards alike", async () => {
    const experiment = "flagged-e";
    const reading = (id: number, annotations: unknown[]) => ({
      experiment_id: experiment,
      id,
      timestamp: `2026-09-14 10:00:0${id % 10}`,
      questions_data: {},
      annotations,
      _commit_version: 1,
      _commit_timestamp: "2026-09-14 10:01:00",
    });
    const phoneFlag = {
      id: "p1",
      rowId: "21",
      type: "flag",
      content: { text: null, flagType: "outlier" },
      createdBy: null,
      createdByName: null,
      createdAt: null,
      updatedAt: null,
    };
    await admin.insert({
      table: "measurements",
      values: [reading(21, [phoneFlag]), reading(22, []), reading(23, [])],
      format: "JSONEachRow",
    });
    // Row 23 carries a flag someone added afterwards, which Postgres holds.
    const params = (flagged: "only" | "exclude", added: string[]): StoreQueryParams => ({
      tableName: "raw_data",
      tableType: "static",
      experimentId: experiment,
      columns: ["id"],
      flagged: { kind: flagged, addedRowIds: added },
    });
    const sortedPage = async (flagged: "only" | "exclude", added: string[]) =>
      (await rowsOf({ ...params(flagged, added), ordering: { column: "id" } })).rows;
    const unsortedIds = async (flagged: "only" | "exclude", added: string[]) =>
      (await rowsOf(params(flagged, added))).rows.flat().sort();
    const count = async (flagged: "only" | "exclude", added: string[]) => {
      const query = adapter.buildExperimentQuery(params(flagged, added));
      assertSuccess(query);
      const counted = await adapter.executeQuery(adapter.countQuery(query.value));
      assertSuccess(counted);
      return counted.value.rows;
    };

    expect(await sortedPage("only", ["23"])).toEqual([["21"], ["23"]]);
    expect(await sortedPage("exclude", ["23"])).toEqual([["22"]]);
    expect(await unsortedIds("only", ["23"])).toEqual(["21", "23"]);
    expect(await count("only", ["23"])).toEqual([["2"]]);

    // Once the flag added afterwards is removed, only the phone's flag keeps its row.
    expect(await sortedPage("only", [])).toEqual([["21"]]);
    expect(await unsortedIds("only", [])).toEqual(["21"]);
    expect(await count("only", [])).toEqual([["1"]]);
    expect(await count("exclude", [])).toEqual([["2"]]);
  });

  it("runs the largest flagged read it takes, whose count fills the store's query size to the byte", async () => {
    const ids = Array.from(
      { length: 14_000 },
      (_, index) => `flagged-${String(index).padStart(56, "0")}`,
    );
    const read = (last: string) =>
      adapter.buildExperimentQuery({
        tableName: "raw_data",
        tableType: "static",
        experimentId: EXPERIMENT,
        columns: ["id"],
        ordering: { column: "id" },
        flagged: { kind: "only", addedRowIds: [...ids, last] },
      });
    let [fits, passes] = [0, 200_000];
    while (passes - fits > 1) {
      const middle = Math.floor((fits + passes) / 2);
      if (read("x".repeat(middle)).isSuccess()) {
        fits = middle;
      } else {
        passes = middle;
      }
    }

    const largest = read("x".repeat(fits));
    assertSuccess(largest);
    const countSql = adapter.countQuery(largest.value).sql;
    assertSuccess(await adapter.executeQuery(largest.value));
    assertSuccess(await adapter.executeQuery(adapter.countQuery(largest.value)));

    const refused = read("x".repeat(passes));
    assertFailure(refused);
    expect(refused.error.code).toBe("FLAGGED_READ_TOO_LARGE");
    // One byte more, sent anyway, is a statement the store refuses too.
    assertFailure(await client.query(countSql.replace("SELECT ", "SELECT  ")));
  });

  describe("custom metadata on a page", () => {
    const experiment = "metadata-e";
    // The three sheets' rows below together, as custom_metadata_schemas.json has gold type them.
    const schema =
      "OBJECT<`Plot no.`: BIGINT, area: DECIMAL(22,2), extra: STRING, note: STRING, soil: STRING>";

    // A sheet as the feed sends it, with the schema gold gives its rows alone.
    const sheet = (
      sheetId: string,
      createdAt: string,
      matchOn: string,
      sheetSchema: string,
      commit = 1,
    ) => ({
      experiment_id: experiment,
      sheet_id: sheetId,
      sheet_created_at: createdAt,
      match_on: matchOn,
      schema: sheetSchema,
      is_deleted: 0,
      _commit_version: commit,
    });

    // A sheet row as the feed sends it from the lakehouse's copy of the sheet.
    const sheetRow = (
      sheetId: string,
      createdAt: string,
      matchOn: string,
      identifier: string,
      fields: Record<string, unknown>,
    ) => ({
      experiment_id: experiment,
      sheet_id: sheetId,
      sheet_created_at: createdAt,
      match_on: matchOn,
      identifier,
      fields: JSON.stringify(fields),
      is_deleted: 0,
      _commit_version: 1,
      _commit_timestamp: "2026-09-14 10:01:00",
    });

    const reading = (id: number, plot: string | null, deviceId: string | null) => ({
      experiment_id: experiment,
      id,
      device_id: deviceId,
      timestamp: `2026-09-14 10:00:0${id % 10}`,
      questions_data: plot === null ? {} : { plot },
      annotations: [],
      _commit_version: 1,
      _commit_timestamp: "2026-09-14 10:01:00",
    });

    /** The experiment's sheets as the store lists them, and their schemas joined. */
    async function sheetsOf(experimentId: string) {
      const sheets = await adapter.getMetadataSheets(experimentId);
      assertSuccess(sheets);
      const joined = VariantSchema.mergeKeepingDecimals(
        sheets.value.flatMap((listed) => listed.schema ?? []),
      );
      return { sheets: sheets.value, schema: joined ?? "" };
    }

    async function page(
      params: Partial<Parameters<ServingStoreAdapter["buildExperimentQuery"]>[0]>,
      experimentId = experiment,
    ) {
      const { sheets, schema: joined } = await sheetsOf(experimentId);
      const data = await rowsOf({
        tableName: "raw_data",
        tableType: "static",
        experimentId,
        variants: [{ columnName: "custom_metadata", schema: joined, suffix: "metadata" }],
        metadataSheets: sheets,
        ...params,
      });
      return data.rows;
    }

    beforeAll(async () => {
      await admin.insert({
        table: "measurements",
        values: [
          reading(31, "A1", "d1"),
          reading(32, "B2", "d2"),
          reading(33, "Z9", "d9"),
          reading(34, null, null),
        ],
        format: "JSONEachRow",
      });
      // The first row of each identifier wins, as the feed matches them.
      await admin.insert({
        table: "metadata_rows",
        values: [
          sheetRow("s-old", "2026-09-01 08:00:00", "plot", "A1", {
            "Plot no.": 3,
            area: 1.15,
            note: "dry",
            soil: "clay",
          }),
          sheetRow("s-old", "2026-09-01 08:00:00", "plot", "B2", {
            area: 12.25,
            note: "wet",
            soil: "sand",
          }),
          sheetRow("s-new", "2026-09-02 08:00:00", "column:device_id", "d1", { soil: "loam" }),
          sheetRow("s-new", "2026-09-02 08:00:00", "column:device_id", "d2", {
            area: 5,
            note: null,
          }),
          sheetRow("s-other", "2026-09-03 08:00:00", "column:timezone", "UTC", {
            extra: "matches nothing",
          }),
        ],
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_sheets",
        values: [
          sheet(
            "s-old",
            "2026-09-01 08:00:00",
            "plot",
            "OBJECT<`Plot no.`: BIGINT, area: DECIMAL(4,2), note: STRING, soil: STRING>",
          ),
          sheet(
            "s-new",
            "2026-09-02 08:00:00",
            "column:device_id",
            "OBJECT<area: BIGINT, note: VOID, soil: STRING>",
          ),
          sheet("s-other", "2026-09-03 08:00:00", "column:timezone", "OBJECT<extra: STRING>"),
        ],
        format: "JSONEachRow",
      });
    });

    it("folds the sheets oldest first, writes decimals at their scale and leaves an unmatched row null", async () => {
      const rows = await page({
        columns: ["id", "soil", "area", "note", "Plot no.", "extra"],
        ordering: { column: "id", direction: "ASC" },
        limit: 10,
      });

      expect(rows).toEqual([
        ["31", "loam", "1.15", "dry", "3", null],
        ["32", "sand", "5.00", null, null, null],
        ["33", null, null, null, null, null],
        ["34", null, null, null, null, null],
      ]);
    });

    it("sorts and filters by a metadata field, reading the whole table's metadata for the page's keys", async () => {
      const byArea = await page({
        columns: ["id", "area"],
        ordering: { column: "area", direction: "DESC" },
        limit: 2,
      });
      const loam = await page({
        columns: ["id"],
        filters: [{ column: "soil", operator: "equals", value: "loam" }],
        ordering: { column: "id", direction: "ASC" },
        limit: 10,
      });

      expect(byArea).toEqual([
        ["32", "5.00"],
        ["31", "1.15"],
      ]);
      expect(loam).toEqual([["31"]]);
    });

    it("lists the sheets oldest first, and their schemas join as gold types their rows together", async () => {
      const { sheets, schema: joined } = await sheetsOf(experiment);

      expect(sheets.map(({ id, matchOn }) => [id, matchOn])).toEqual([
        ["s-old", "plot"],
        ["s-new", "column:device_id"],
        ["s-other", "column:timezone"],
      ]);
      expect(joined).toBe(schema);
    });

    it("lists a sheet at its newest commit, and no longer once it is deleted", async () => {
      const edited = "edited-e";
      await admin.insert({
        table: "metadata_sheets",
        values: [
          {
            ...sheet("s1", "2026-09-01 08:00:00", "plot", "OBJECT<soil: STRING>"),
            experiment_id: edited,
          },
          {
            ...sheet("s1", "2026-09-01 08:00:00", "plot", "OBJECT<area: BIGINT>", 2),
            experiment_id: edited,
          },
          {
            ...sheet("s2", "2026-09-02 08:00:00", "plot", "OBJECT<ph: BIGINT>"),
            experiment_id: edited,
          },
          {
            ...sheet("s2", "2026-09-02 08:00:00", "plot", "OBJECT<ph: BIGINT>", 3),
            experiment_id: edited,
            is_deleted: 1,
          },
        ],
        format: "JSONEachRow",
      });

      const sheets = await adapter.getMetadataSheets(edited);

      assertSuccess(sheets);
      expect(sheets.value).toEqual([
        { id: "s1", matchOn: "plot", schema: "OBJECT<area: BIGINT>", version: "2" },
      ]);
    });

    it("reads a sheet's numbers as written, past a double's digits, and finds a row by its exact value", async () => {
      const digits = "digits-e";
      const rows = [
        { plot: "D1", v: 9284706.999413481, "Plot no.": 1, note: null },
        { plot: "D2", v: 29667.680253587514, "Plot no.": 2, note: "dry" },
      ];
      await admin.insert({
        table: "measurements",
        values: rows.map(({ plot }, index) => ({
          ...reading(51 + index, plot, null),
          experiment_id: digits,
        })),
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_rows",
        values: rows.map(({ plot, ...fields }) => ({
          ...sheetRow("s-digits", "2026-09-01 08:00:00", "plot", plot, fields),
          experiment_id: digits,
        })),
        format: "JSONEachRow",
      });
      // As custom_metadata_schemas.json has gold type the two fractions, with the rest of the row.
      await admin.insert({
        table: "metadata_sheets",
        values: [
          {
            ...sheet(
              "s-digits",
              "2026-09-01 08:00:00",
              "plot",
              "OBJECT<`Plot no.`: BIGINT, note: STRING, v: DECIMAL(19,12)>",
            ),
            experiment_id: digits,
          },
        ],
        format: "JSONEachRow",
      });

      const shown = await page(
        {
          columns: ["id", "v", "Plot no.", "note"],
          ordering: { column: "id", direction: "ASC" },
          limit: 10,
        },
        digits,
      );
      const found = await page(
        {
          columns: ["id"],
          filters: [{ column: "v", operator: "equals", value: 29667.680253587514 }],
          limit: 10,
        },
        digits,
      );

      expect(shown).toEqual([
        ["51", "9284706.999413481000", "1", null],
        ["52", "29667.680253587514", "2", "dry"],
      ]);
      expect(found).toEqual([["52"]]);
    });

    it("reads only a row's own keys, never a key nested in one of its values", async () => {
      const nested = "nested-e";
      await admin.insert({
        table: "measurements",
        values: [{ ...reading(61, "N1", null), experiment_id: nested }],
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_rows",
        values: [
          sheetRow("s-flat", "2026-09-01 08:00:00", "plot", "N1", { soil: "clay" }),
          sheetRow("s-nested", "2026-09-02 08:00:00", "plot", "N1", { extra: { soil: "sand" } }),
          sheetRow("s-nested", "2026-09-02 08:00:00", "plot", "N2", { soil: "silt" }),
        ].map((row) => ({ ...row, experiment_id: nested })),
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_sheets",
        values: [
          sheet("s-flat", "2026-09-01 08:00:00", "plot", "OBJECT<soil: STRING>"),
          sheet(
            "s-nested",
            "2026-09-02 08:00:00",
            "plot",
            "OBJECT<extra: OBJECT<soil: STRING>, soil: STRING>",
          ),
        ].map((row) => ({ ...row, experiment_id: nested })),
        format: "JSONEachRow",
      });

      const rows = await page({ columns: ["id", "soil"], limit: 10 }, nested);

      expect(rows).toEqual([["61", "clay"]]);
    });

    it("shows an explicit null in a mix of kinds as null, as the warehouse does, and a missing key as none", async () => {
      const mixed = "mixed-e";
      const plots = ["M1", "M2", "M3", "M4"];
      await admin.insert({
        table: "measurements",
        values: plots.map((plot, index) => ({
          ...reading(71 + index, plot, null),
          experiment_id: mixed,
        })),
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_rows",
        values: [
          sheetRow("s-mix", "2026-09-01 08:00:00", "plot", "M1", { mix: 5 }),
          sheetRow("s-mix", "2026-09-01 08:00:00", "plot", "M2", { mix: "dry" }),
          sheetRow("s-mix", "2026-09-01 08:00:00", "plot", "M3", { mix: null }),
          sheetRow("s-mix", "2026-09-01 08:00:00", "plot", "M4", { soil: "clay" }),
        ].map((row) => ({ ...row, experiment_id: mixed })),
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_sheets",
        values: [
          {
            ...sheet("s-mix", "2026-09-01 08:00:00", "plot", "OBJECT<mix: VARIANT, soil: STRING>"),
            experiment_id: mixed,
          },
        ],
        format: "JSONEachRow",
      });

      const shown = await page(
        { columns: ["id", "mix"], ordering: { column: "id", direction: "ASC" }, limit: 10 },
        mixed,
      );
      const nulls = await page(
        {
          columns: ["id"],
          filters: [{ column: "mix", operator: "contains", value: "null" }],
          limit: 10,
        },
        mixed,
      );

      expect(shown).toEqual([
        ["71", "5"],
        ["72", '"dry"'],
        ["73", "null"],
        ["74", null],
      ]);
      expect(nulls).toEqual([["73"]]);
    });

    it("reads integers past the 64-bit ranges as the warehouse does, with the rest of their row", async () => {
      const codes = "codes-e";
      const rows = [
        { plot: "C1", soil: "clay", code: 2 ** 64 },
        { plot: "C2", soil: "sand", code: 1e20 },
        { plot: "C3", soil: "silt", code: -(2 ** 63) },
        {
          plot: "C4",
          soil: "loam",
          code: Number("-1234567890123456800"),
          small: Number("-1234567890123456800"),
        },
      ];
      // As custom_metadata_schemas.json has gold type these rows.
      const codesSchema = "OBJECT<code: DECIMAL(21,0), small: BIGINT, soil: STRING>";
      await admin.insert({
        table: "measurements",
        values: rows.map(({ plot }, index) => ({
          ...reading(41 + index, plot, null),
          experiment_id: codes,
        })),
        format: "JSONEachRow",
      });
      // Spark writes these integers as plain digits.
      await admin.insert({
        table: "metadata_rows",
        values: rows.map(({ plot, ...fields }) => ({
          ...sheetRow("s-codes", "2026-09-01 08:00:00", "plot", plot, fields),
          experiment_id: codes,
        })),
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_sheets",
        values: [
          {
            ...sheet("s-codes", "2026-09-01 08:00:00", "plot", codesSchema),
            experiment_id: codes,
          },
        ],
        format: "JSONEachRow",
      });

      const rowsRead = await page(
        {
          columns: ["id", "soil", "code", "small"],
          ordering: { column: "id", direction: "ASC" },
          limit: 10,
        },
        codes,
      );

      expect(rowsRead).toEqual([
        ["41", "clay", "18446744073709552000", null],
        ["42", "sand", "100000000000000000000", null],
        ["43", "silt", "-9223372036854776000", null],
        ["44", "loam", "-1234567890123456800", "-1234567890123456800"],
      ]);
    });

    describe("a wide sheet under the reader's limits", () => {
      const wide = "wide-e";
      const readings = 100_000;
      const plots = 5_000;
      const columns = Array.from({ length: 60 }, (_, n) => `c${String(n).padStart(2, "0")}`);
      const plotFields = Array.from({ length: plots }, (_, plot) => ({
        area: plot / 4,
        ...Object.fromEntries(columns.map((column) => [column, `v${plot % 50}-${column}`])),
      }));
      // Gold types a quarter's fractions and the whole plots together as DECIMAL(22,2).
      const wideSchema = `OBJECT<area: DECIMAL(22,2), ${columns.map((column) => `${column}: STRING`).join(", ")}>`;
      let capped: ServingStoreClientService;
      let cappedAdapter: ServingStoreAdapter;

      function wideQuery(
        params: Partial<Parameters<ServingStoreAdapter["buildExperimentQuery"]>[0]>,
      ) {
        const query = cappedAdapter.buildExperimentQuery({
          tableName: "raw_data",
          tableType: "static",
          experimentId: wide,
          variants: [{ columnName: "custom_metadata", schema: wideSchema, suffix: "metadata" }],
          metadataSheets: [{ id: "s-wide", matchOn: "plot", schema: wideSchema, version: "1" }],
          ...params,
        });
        assertSuccess(query);
        return query.value;
      }

      async function wideRows(
        params: Partial<Parameters<ServingStoreAdapter["buildExperimentQuery"]>[0]>,
      ) {
        const data = await cappedAdapter.executeQuery(wideQuery(params));
        assertSuccess(data);
        return data.value.rows;
      }

      beforeAll(async () => {
        // The reader profile's per-query memory and time, and the dev store's two cores.
        await admin.command({
          query: `CREATE USER IF NOT EXISTS capped_reader IDENTIFIED BY '${STORE_PASSWORD}' SETTINGS max_memory_usage = 4294967296, max_execution_time = 30, max_threads = 2`,
        });
        await admin.command({ query: "GRANT SELECT ON store.* TO capped_reader" });
        const config = new ConfigService({
          servingStore: { url: STORE_URL, username: "capped_reader", password: STORE_PASSWORD },
        });
        capped = new ServingStoreClientService(new ServingStoreConfigService(config));
        cappedAdapter = new ServingStoreAdapter(capped);

        const start = Date.UTC(2026, 8, 1);
        await admin.insert({
          table: "measurements",
          values: Array.from({ length: readings }, (_, id) => ({
            experiment_id: wide,
            id,
            device_id: "d1",
            timestamp: new Date(start + id * 1000).toISOString().replace("T", " ").slice(0, 19),
            questions_data: { plot: `P${id % plots}` },
            annotations: [],
            _commit_version: 1,
            _commit_timestamp: "2026-09-14 10:01:00",
          })),
          format: "JSONEachRow",
        });
        await admin.insert({
          table: "metadata_rows",
          values: plotFields.map((fields, plot) => ({
            ...sheetRow("s-wide", "2026-09-01 08:00:00", "plot", `P${plot}`, fields),
            experiment_id: wide,
          })),
          format: "JSONEachRow",
        });
      }, 120_000);

      afterAll(async () => {
        await capped.onModuleDestroy();
        await admin.command({ query: "DROP USER IF EXISTS capped_reader" });
      });

      it("sorts and filters a page by a metadata field", async () => {
        const byArea = await wideRows({
          columns: ["id", "area"],
          ordering: { column: "area", direction: "DESC" },
          limit: 10,
        });
        const filtered = await wideRows({
          columns: ["id", "c07"],
          filters: [{ column: "c07", operator: "equals", value: "v3-c07" }],
          ordering: { column: "id", direction: "ASC" },
          limit: 3,
        });

        expect(byArea).toHaveLength(10);
        expect(new Set(byArea.map(([, area]) => area))).toEqual(new Set(["1249.75"]));
        expect(filtered).toEqual([
          ["3", "v3-c07"],
          ["53", "v3-c07"],
          ["103", "v3-c07"],
        ]);
      }, 60_000);

      it("lists a metadata field's distinct values and counts a filtered page", async () => {
        const values = await wideRows({ columns: ["c07"], distinct: true, limit: 100 });
        const count = await cappedAdapter.executeQuery(
          cappedAdapter.countQuery(
            wideQuery({ filters: [{ column: "c07", operator: "equals", value: "v3-c07" }] }),
          ),
        );

        expect(values).toHaveLength(50);
        assertSuccess(count);
        expect(count.value.rows).toEqual([[String(readings / 50)]]);
      }, 60_000);
    });
  });
});

describe("StoreTables against the migrations", () => {
  // A sorted page picks its rows by the key, so it must be the table's whole sorting key; and the
  // client folds each month on its own, which holds only while a row's month is part of its key.
  it.each([
    ["measurements", MEASUREMENTS_TABLE],
    ["macro_results", MACRO_RESULTS_TABLE],
    ["uploads", UPLOADS_TABLE],
  ])(
    "%s is read by its migration's sorting key, which holds its partition's time",
    (name, table) => {
      const create =
        migrationStatements().find((statement) =>
          statement.includes(`CREATE TABLE IF NOT EXISTS ${name}\n`),
        ) ?? "";

      expect(create).toContain(`ORDER BY (${["experiment_id", ...table.key].join(", ")})`);
      const partitionTime = /PARTITION BY toYYYYMM\((\w+)\)/.exec(create)?.[1];
      expect(table.key).toContain(partitionTime);
    },
  );

  it.each([
    ["macro_results", MACRO_RESULTS_TABLE],
    ["uploads", UPLOADS_TABLE],
  ])("%s holds the text each payload is shown from", (name, table) => {
    const texts = Object.values(table.payloadTexts ?? {});

    expect(texts).toHaveLength(1);
    for (const text of texts) {
      const added = `ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS ${text} Nullable(String)`;
      expect(migrationStatements().some((statement) => statement.includes(added))).toBe(true);
    }
  });
});

/** The migrations as their runner applies them, one statement at a time. */
function migrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return files.flatMap((file) => {
    const statements: string[] = [];
    let lines: string[] = [];
    for (const line of readFileSync(resolve(MIGRATIONS, file), "utf-8").split("\n")) {
      lines.push(line);
      if (line.trimEnd().endsWith(";")) {
        statements.push(lines.join("\n").trimEnd().replace(/;$/, ""));
        lines = [];
      }
    }
    const rest = lines.filter((line) => line.trim() !== "" && !line.trim().startsWith("--"));
    return rest.length > 0 ? [...statements, lines.join("\n")] : statements;
  });
}
