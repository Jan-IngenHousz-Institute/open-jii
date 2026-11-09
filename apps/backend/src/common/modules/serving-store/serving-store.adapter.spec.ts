import { createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { AppError, assertFailure, assertSuccess, failure, success } from "../../utils/fp-utils";
import { VariantSchema } from "../databricks/services/query-builder/schema/variant-schema";
import { ServingStoreClientService } from "./services/client/client.service";
import { ServingStoreConfigService } from "./services/config/config.service";
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
    vi.spyOn(client, "query").mockResolvedValue(success({ rows: [["12"]] }));

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
    vi.spyOn(client, "query").mockResolvedValue(
      success({
        rows: [
          ["1", "2026-09-14 16:56:31.972123", 3, "u1", '{"x":1}'],
          ["2", null, null, null, null],
        ],
      }),
    );

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
      device: "thing-1",
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
          _commit_version: 1,
          _commit_timestamp: "2026-09-01 10:00:01",
        },
        {
          experiment_id: "e2",
          id: 2,
          upload_table_id: "t2",
          uploaded_at: "2026-09-02 10:00:00",
          uploaded_data: { "Temp\\": 2 },
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
