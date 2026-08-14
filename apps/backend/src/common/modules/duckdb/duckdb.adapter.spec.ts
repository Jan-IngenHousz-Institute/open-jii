import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import { DuckDbQueryBuilderService } from "../databricks/services/query-builder/duckdb-query-builder.service";
import { DuckDbAdapter } from "./duckdb.adapter";
import { DuckDbConfigService } from "./services/config/duckdb-config.service";
import { SparkTypeMapper } from "./services/schema/spark-type-mapper";
import { DuckDbSessionService } from "./services/session/duckdb-session.service";
import { DeltaSharingService } from "./services/sharing/delta-sharing.service";

const TEST_CONFIG = {
  duckdb: {
    readAdapter: "duckdb",
    localMode: true,
    memoryLimit: "512MB",
    threads: "1",
  },
  databricks: {
    centrumSchemaName: "centrum",
    rawDataTableName: "enriched_experiment_raw_data",
    deviceDataTableName: "experiment_device_data",
    macroDataTableName: "enriched_experiment_macro_data",
    uploadedDataTableName: "enriched_experiment_uploaded_data",
  },
};

const MACRO_SCHEMA = "OBJECT<SPAD: DOUBLE, `Leaf Temp`: DOUBLE>";

describe("DuckDbAdapter (localMode end-to-end)", () => {
  let adapter: DuckDbAdapter;
  let session: DuckDbSessionService;

  beforeAll(async () => {
    const configService = new ConfigService(TEST_CONFIG);
    const duckDbConfig = new DuckDbConfigService(configService);

    session = new DuckDbSessionService(duckDbConfig);
    adapter = new DuckDbAdapter(
      duckDbConfig,
      session,
      new DeltaSharingService(new HttpService(axios.create()), duckDbConfig),
      new DuckDbQueryBuilderService(),
      new SparkTypeMapper(),
    );

    await session.run(`
      CREATE TABLE experiment_table_metadata AS
      SELECT * FROM (VALUES
        ('exp-1', 'macro-1', 'macro', 'Photosynthesis', CAST(2 AS BIGINT),
          '${MACRO_SCHEMA}', NULL, NULL, NULL),
        ('exp-1', 'raw_data', 'static', NULL, CAST(10 AS BIGINT), NULL, NULL, NULL, NULL)
      ) AS t(experiment_id, identifier, table_type, display_name, row_count,
             macro_schema, questions_schema, custom_metadata_schema, upload_schema)
    `);

    await session.run(`
      CREATE TABLE enriched_experiment_macro_data AS
      SELECT * FROM (VALUES
        ('exp-1', 'macro-1', TIMESTAMP '2026-01-01 10:00:00',
          CAST({'SPAD': 1.5, 'Leaf Temp': 21.0} AS VARIANT),
          {'id': 'user-1', 'name': 'Ada', 'avatar': 'a.png'}),
        ('exp-1', 'macro-1', TIMESTAMP '2026-01-01 11:00:00',
          CAST({'SPAD': 2.5, 'Leaf Temp': 22.0} AS VARIANT),
          {'id': 'user-2', 'name': 'Grace', 'avatar': 'g.png'}),
        ('exp-2', 'macro-1', TIMESTAMP '2026-01-02 09:00:00',
          CAST({'SPAD': 9.0, 'Leaf Temp': 30.0} AS VARIANT),
          {'id': 'user-3', 'name': 'Alan', 'avatar': NULL})
      ) AS t(experiment_id, macro_id, "timestamp", macro_output, contributor)
    `);
  });

  it("reads experiment table metadata with parsed row counts and schemas", async () => {
    const result = await adapter.getExperimentTableMetadata("exp-1", { identifier: "macro-1" });

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    expect(result.value).toEqual([
      {
        identifier: "macro-1",
        tableType: "macro",
        displayName: "Photosynthesis",
        rowCount: 2,
        macroSchema: MACRO_SCHEMA,
        questionsSchema: null,
        customMetadataSchema: null,
        uploadSchema: null,
      },
    ]);
  });

  it("serves a full macro read: variant flattening, string cells, Spark type_text", async () => {
    const queryResult = await adapter.buildExperimentQuery({
      tableName: "macro-1",
      tableType: "macro",
      experimentId: "exp-1",
      variants: [{ columnName: "macro_output", schema: MACRO_SCHEMA }],
      exceptColumns: ["experiment_id", "macro_id"],
      orderBy: "timestamp",
      orderDirection: "ASC",
    });
    expect(queryResult.isSuccess()).toBe(true);
    if (queryResult.isFailure()) throw queryResult.error;

    const dataResult = await adapter.executeSqlQuery("centrum", queryResult.value);
    expect(dataResult.isSuccess()).toBe(true);
    if (dataResult.isFailure()) throw dataResult.error;

    const { columns, rows, totalRows } = dataResult.value;
    expect(totalRows).toBe(2);

    const columnByName = new Map(columns.map((c) => [c.name, c]));
    expect(columnByName.get("SPAD")?.type_text).toBe("DOUBLE");
    expect(columnByName.get("contributor")?.type_text).toBe(
      "STRUCT<id: STRING, name: STRING, avatar: STRING>",
    );
    expect(columnByName.has("macro_output")).toBe(false);
    expect(columnByName.has("experiment_id")).toBe(false);

    const spadIndex = columns.findIndex((c) => c.name === "SPAD");
    const contributorIndex = columns.findIndex((c) => c.name === "contributor");
    expect(rows[0][spadIndex]).toBe("1.5");

    const contributorCell = rows[0][contributorIndex];
    expect(contributorCell).not.toBeNull();
    expect(JSON.parse(contributorCell ?? "")).toEqual({
      id: "user-1",
      name: "Ada",
      avatar: "a.png",
    });
  });

  it("returns COUNT cells as strings so callers can Number() them", async () => {
    const result = await adapter.executeSqlQuery(
      "centrum",
      'SELECT COUNT(*) AS total FROM "enriched_experiment_macro_data"',
    );

    expect(result.isSuccess()).toBe(true);
    if (result.isFailure()) throw result.error;
    expect(result.value.rows[0][0]).toBe("3");
    expect(Number(result.value.rows[0][0])).toBe(3);
  });

  it("fails unknown static tables without touching the engine", async () => {
    const result = await adapter.buildExperimentQuery({
      tableName: "not-a-table",
      tableType: "static",
      experimentId: "exp-1",
    });

    expect(result.isFailure()).toBe(true);
    if (result.isSuccess()) throw new Error("expected failure");
    expect(result.error.code).toBe("UNKNOWN_TABLE_MAPPING");
  });

  it("surfaces engine errors as AppError failures with the SQL logged", async () => {
    const result = await adapter.executeSqlQuery("centrum", "SELECT * FROM missing_table");

    expect(result.isFailure()).toBe(true);
    if (result.isSuccess()) throw new Error("expected failure");
    expect(result.error.message).toContain("DuckDB query execution failed");
  });
});
