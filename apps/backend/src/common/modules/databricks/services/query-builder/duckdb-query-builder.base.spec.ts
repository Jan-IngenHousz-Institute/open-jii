import type { DuckDBConnection } from "@duckdb/node-api";
import { DuckDBInstance } from "@duckdb/node-api";

import { MACRO_TABLE_CONFIG } from "../../../../../experiments/core/models/experiment-data.model";
import { DuckDbSqlQueryBuilder, DuckDbVariantQueryBuilder } from "./duckdb-query-builder.base";
import { DuckDbQueryBuilderService } from "./duckdb-query-builder.service";
import { DUCKDB_ENRICHMENT_SQL } from "./enrichment-sql";

describe("DuckDbQueryBuilder", () => {
  describe("SQL generation", () => {
    let builder: DuckDbSqlQueryBuilder;

    beforeEach(() => {
      builder = new DuckDbSqlQueryBuilder();
    });

    it("escapes identifiers with double quotes", () => {
      const query = builder.select(["col1", 'weird"name']).from("t").build();
      expect(query).toBe('SELECT "col1", "weird""name" FROM t');
    });

    it("escapes dotted struct paths per segment", () => {
      const query = builder.from("t").orderBy("contributor.name", "DESC").build();
      expect(query).toBe('SELECT * FROM t ORDER BY "contributor"."name" DESC NULLS LAST');
    });

    it("emits EXCLUDE for star column exclusion", () => {
      const query = builder.from("t").except(["a", "b"]).build();
      expect(query).toBe('SELECT * EXCLUDE ("a", "b") FROM t');
    });

    it("builds the NULL-propagating pseudonym expression", () => {
      const sql = builder.buildFilterCondition({
        column: "contributor.id",
        operator: "equals",
        value: "Contributor-ABCDEF",
        contributorPseudonymSalt: "exp-1",
      });
      expect(sql).toBe(
        `'Contributor-' || upper(substr(sha256('exp-1:' || "contributor"."id"), 1, 6)) = 'Contributor-ABCDEF'`,
      );
    });

    it("casts to TIMESTAMP inside date_trunc", () => {
      const expr = builder.buildTimeBucketExpression("created_at", "hour");
      expect(expr.sql).toBe(`date_trunc('hour', CAST("created_at" AS TIMESTAMP))`);
      expect(expr.alias).toBe("created_at_hour");
    });

    it("spells out Spark's null ordering, which DuckDB does not share", () => {
      expect(builder.from("t").orderBy("value", "ASC").build()).toBe(
        'SELECT * FROM t ORDER BY "value" ASC NULLS FIRST',
      );
      expect(new DuckDbSqlQueryBuilder().from("t").orderBy("value", "DESC").build()).toBe(
        'SELECT * FROM t ORDER BY "value" DESC NULLS LAST',
      );
    });
  });

  describe("execution against in-memory DuckDB", () => {
    let connection: DuckDBConnection;
    let instance: DuckDBInstance;
    let service: DuckDbQueryBuilderService;

    const run = async (sql: string): Promise<Record<string, unknown>[]> => {
      const reader = await connection.runAndReadAll(sql);
      return reader.getRowObjects();
    };

    beforeAll(async () => {
      instance = await DuckDBInstance.create(":memory:");
      connection = await instance.connect();
      service = new DuckDbQueryBuilderService();

      // Shape mirrors enriched_experiment_macro_data: base columns + a native
      // VARIANT column with per-experiment fields (incl. a spaced name and a
      // nested object) + a contributor struct.
      await connection.run(`
        CREATE TABLE macro_data AS
        SELECT * FROM (VALUES
          ('exp-1', 'm-1', TIMESTAMP '2026-01-01 10:15:00',
            CAST({'SPAD': 1.5, 'Leaf Temp': 21.0, 'meta': {'unit': 'C'}} AS VARIANT),
            {'id': 'user-1', 'name': 'Ada'}, ['a', 'b']),
          ('exp-1', 'm-1', TIMESTAMP '2026-01-01 10:45:00',
            CAST({'SPAD': 2.5, 'Leaf Temp': 22.0, 'meta': {'unit': 'C'}} AS VARIANT),
            {'id': 'user-2', 'name': 'Grace'}, ['b']),
          ('exp-1', 'm-1', TIMESTAMP '2026-01-01 11:15:00',
            CAST({'SPAD': 3.5, 'Leaf Temp': 23.0, 'meta': {'unit': 'C'}} AS VARIANT),
            {'id': NULL, 'name': NULL}, ['c']),
          ('exp-2', 'm-1', TIMESTAMP '2026-01-02 09:00:00',
            CAST({'SPAD': 9.0, 'Leaf Temp': 30.0, 'meta': {'unit': 'F'}} AS VARIANT),
            {'id': 'user-3', 'name': 'Alan'}, ['z'])
        ) AS t(experiment_id, macro_id, "timestamp", macro_output, contributor, tags)
      `);
    });

    // The native handles keep the worker's event loop alive until closed.
    afterAll(() => {
      connection.closeSync();
      instance.closeSync();
    });

    const MACRO_SCHEMA = "OBJECT<SPAD: DOUBLE, `Leaf Temp`: DOUBLE, meta: OBJECT<unit: STRING>>";

    it("resolves a filter on an enrichment column", async () => {
      // The column is a SELECT alias, and WHERE is resolved before aliases
      // exist, so the filter belongs above the join rather than in the
      // subquery the join reads from.
      await connection.run(`
        CREATE OR REPLACE TABLE filter_rows AS
        SELECT * FROM (VALUES
          ('exp-1', CAST(1 AS BIGINT), 'user-1'),
          ('exp-1', CAST(2 AS BIGINT), 'user-2')
        ) AS t(experiment_id, id, user_id)
      `);
      await connection.run(`
        CREATE OR REPLACE TABLE filter_contributors AS
        SELECT * FROM (VALUES
          ('exp-1', 'user-1', {'id': 'user-1', 'name': 'Ada'}),
          ('exp-1', 'user-2', {'id': 'user-2', 'name': 'Grace'})
        ) AS t(experiment_id, user_id, "user")
      `);

      const rows = await run(
        new DuckDbSqlQueryBuilder()
          .from("filter_rows")
          .except(["experiment_id"])
          .join({
            table: "filter_contributors",
            alias: "enr_contributor",
            on: [
              { served: "experiment_id", joined: "experiment_id" },
              { served: "user_id", joined: "user_id" },
            ],
            select: [{ expression: "enr_contributor.user", alias: "contributor" }],
          })
          .whereEquals("experiment_id", "exp-1")
          .filter({ column: "contributor.name", operator: "equals", value: "Grace" })
          .build(),
      );

      expect(rows).toHaveLength(1);
      expect(String(rows[0].id)).toBe("2");
    });

    it("keeps a join's name when it re-projects an excluded base column", async () => {
      // The base star and the join's projection share one SELECT, so a column
      // the join overwrites has to leave the star there. Excluding it a level
      // up leaves both alive: DuckDB renames one, Spark calls it ambiguous,
      // and either way the un-enriched value is what reaches the reader.
      await connection.run(`
        CREATE OR REPLACE TABLE shadow_rows AS
        SELECT * FROM (VALUES
          ('exp-1', CAST(1 AS BIGINT), ['from-base'], CAST({'plot': 'A'} AS VARIANT))
        ) AS t(experiment_id, id, annotations, questions_data)
      `);
      await connection.run(`
        CREATE OR REPLACE TABLE shadow_annotations AS
        SELECT * FROM (VALUES ('exp-1', CAST(1 AS BIGINT), ['from-join']))
        AS t(experiment_id, id, db_annotations)
      `);

      const sql = new DuckDbVariantQueryBuilder()
        .from("shadow_rows")
        .parseVariant("questions_data", "OBJECT<plot: STRING>")
        .except(["experiment_id", "annotations"])
        .join({
          table: "shadow_annotations",
          alias: "enr_annotation",
          on: [
            { served: "experiment_id", joined: "experiment_id" },
            { served: "id", joined: "id" },
          ],
          select: [
            {
              expression: "list_concat(base.annotations, enr_annotation.db_annotations)",
              alias: "annotations",
            },
          ],
        })
        .build();

      const rows = await run(sql);

      expect(Object.keys(rows[0])).toContain("annotations");
      expect(Object.keys(rows[0])).not.toContain("annotations_1");
      expect(JSON.stringify(rows[0].annotations)).toContain("from-base");
      expect(JSON.stringify(rows[0].annotations)).toContain("from-join");
      // The variant alongside it still flattens.
      expect(rows[0].plot).toBe("A");
    });

    it("merges custom metadata, matching on a question answer", async () => {
      // A blob selects its row either by an allowlisted column or by a
      // question answer, and merges oldest-first so later blobs win.
      const older = JSON.stringify({
        identifierColumnId: "plot",
        experimentQuestionId: "select_plot",
        rows: [
          { _id: "r1", plot: "A", treatment: "control", depth: 10 },
          { _id: "r2", plot: "B", treatment: "nitrogen", depth: 20 },
        ],
      });
      const newer = JSON.stringify({
        identifierColumnId: "plot",
        experimentQuestionId: "select_plot",
        rows: [{ _id: "r3", plot: "B", treatment: "nitrogen-revised" }],
      });

      await connection.run(`
        CREATE OR REPLACE TABLE meta_rows AS
        SELECT * FROM (VALUES
          ('exp-1', CAST(1 AS BIGINT), 'dev-1', CAST('{"select_plot":"B"}' AS JSON)),
          ('exp-1', CAST(2 AS BIGINT), 'dev-2', CAST('{"select_plot":"A"}' AS JSON)),
          ('exp-1', CAST(3 AS BIGINT), 'dev-3', CAST('{"select_plot":"Z"}' AS JSON))
        ) AS t(experiment_id, id, device_id, questions_data)
      `);
      await connection.run(`
        CREATE OR REPLACE TABLE meta_source AS
        SELECT * FROM (VALUES
          ('exp-1', 'm1', TIMESTAMP '2026-01-01', CAST('${older}' AS JSON)),
          ('exp-1', 'm2', TIMESTAMP '2026-02-01', CAST('${newer}' AS JSON))
        ) AS t(experiment_id, metadata_id, created_at, metadata)
      `);

      const { derive, expression } = DUCKDB_ENRICHMENT_SQL.customMetadata({
        matchableColumns: ["device_id"],
        hasQuestionsData: true,
      });

      const rows = await run(
        new DuckDbSqlQueryBuilder()
          .from("meta_rows")
          .except(["experiment_id", "questions_data"])
          .join({
            table: derive.replace("{relation}", "meta_source"),
            alias: "enr_metadata",
            on: [{ served: "experiment_id", joined: "experiment_id" }],
            select: [{ expression, alias: "custom_metadata" }],
          })
          .build(),
      );

      const metadata = new Map(
        rows.map((row) => [
          String(row.id),
          JSON.stringify(row.custom_metadata, (_key: string, value: unknown) =>
            typeof value === "bigint" ? String(value) : value,
          ),
        ]),
      );

      // Plot B appears in both blobs; the newer overwrites treatment while
      // depth survives from the older one.
      expect(metadata.get("1")).toContain("nitrogen-revised");
      expect(metadata.get("1")).toContain("20");
      expect(metadata.get("1")).not.toContain('"nitrogen"');

      // Plot A only exists in the older blob.
      expect(metadata.get("2")).toContain("control");

      // The identifier column and the internal id never reach the reader.
      expect(metadata.get("2")).not.toContain("plot");
      expect(metadata.get("2")).not.toContain("_id");

      // Plot Z matches no row in either blob.
      expect(metadata.get("3")).toBe("null");
    });

    it("runs the real enrichment config end to end", async () => {
      // Runs the served configuration itself, so a spelling that only this
      // engine rejects cannot pass unnoticed.
      await connection.run(`
        CREATE OR REPLACE TABLE raw_rows AS
        SELECT * FROM (VALUES
          ('exp-1', CAST(1 AS BIGINT), 'client-1', 'user-1',
           [struct_pack(id := 'up-1', rowId := '1', type := 'comment',
                        content := struct_pack("text" := 'from payload', flagType := NULL),
                        createdBy := 'user-1', createdByName := 'Ada',
                        createdAt := TIMESTAMP '2026-01-01',
                        updatedAt := TIMESTAMP '2026-01-01')])
        ) AS t(experiment_id, id, client_id, user_id, annotations)
      `);
      await connection.run(`
        CREATE OR REPLACE TABLE contributors AS
        SELECT * FROM (VALUES ('exp-1', 'user-1', {'id': 'user-1', 'name': 'Ada'}))
        AS t(experiment_id, user_id, "user")
      `);
      await connection.run(`
        CREATE OR REPLACE TABLE annotations_source AS
        SELECT * FROM (VALUES
          ('exp-1', '1', 'ann-1', 'comment', 'stored', NULL, 'user-1', 'Ada',
           TIMESTAMP '2026-01-02', TIMESTAMP '2026-01-02')
        ) AS t(experiment_id, row_id, id, type, content_text, flag_type,
               user_id, user_name, created_at, updated_at)
      `);

      const [contributorJoin, , annotationJoin] =
        MACRO_TABLE_CONFIG.enrichmentJoins(DUCKDB_ENRICHMENT_SQL);
      const sources: Record<string, string> = {
        experiment_contributors: "contributors",
        experiment_annotations_source: "annotations_source",
      };

      // annotations is excluded from the base star because the join re-projects
      // it under the same name; leaving both in place shadows the merged one.
      const builder = new DuckDbSqlQueryBuilder()
        .from("raw_rows")
        .except(["experiment_id", "annotations"]);
      for (const join of [contributorJoin, annotationJoin]) {
        const source = sources[join.relation];
        builder.join({
          ...join,
          table: join.derive ? join.derive.replace("{relation}", source) : source,
        });
      }

      const rows = await run(builder.build());

      // DuckDB returns BIGINT as a bigint, which JSON.stringify refuses.
      const show = (value: unknown): string =>
        JSON.stringify(value, (_key: string, inner: unknown) =>
          typeof inner === "bigint" ? String(inner) : inner,
        );

      expect(rows).toHaveLength(1);
      expect(show(rows[0].contributor)).toContain("Ada");
      // Payload annotations first, then the stored ones, as the pipeline concatenates them.
      const annotations = show(rows[0].annotations);
      expect(annotations.indexOf("up-1")).toBeGreaterThanOrEqual(0);
      expect(annotations.indexOf("ann-1")).toBeGreaterThan(annotations.indexOf("up-1"));
    });

    it("carries an enrichment join through the variant path", async () => {
      // This builder reimplements build() rather than extending the Spark
      // twin, so a join reaches it only when wired here as well. Nothing
      // fails when it is not: the column simply vanishes.
      await connection.run(`
        CREATE OR REPLACE TABLE devices AS
        SELECT * FROM (VALUES ('exp-1', 'm-1', {'name': 'Sensor A'}))
        AS t(experiment_id, macro_id, device)
      `);

      const sql = service.buildQuery({
        table: "macro_data",
        variants: [{ columnName: "macro_output", schema: MACRO_SCHEMA }],
        whereConditions: [["experiment_id", "exp-1"]],
        exceptColumns: ["experiment_id"],
        joins: [
          {
            table: "devices",
            alias: "d",
            on: [
              { served: "experiment_id", joined: "experiment_id" },
              { served: "macro_id", joined: "macro_id" },
            ],
            select: [{ expression: "d.device", alias: "device" }],
          },
        ],
      });

      expect(sql.isSuccess()).toBe(true);
      if (!sql.isSuccess()) {
        return;
      }

      const rows = await run(sql.value);

      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row).toHaveProperty("device");
        expect(JSON.stringify(row.device)).toContain("Sensor A");
      }
      // The joined relation's own keys must not reach the result.
      expect(Object.keys(rows[0])).not.toContain("experiment_id");
    });

    const buildQuery = (
      overrides: Partial<Parameters<DuckDbQueryBuilderService["buildQuery"]>[0]> = {},
    ): string => {
      const result = service.buildQuery({
        table: "macro_data",
        variants: [{ columnName: "macro_output", schema: MACRO_SCHEMA }],
        whereConditions: [["experiment_id", "exp-1"]],
        exceptColumns: ["experiment_id"],
        ...overrides,
      });
      expect(result.isSuccess()).toBe(true);
      if (result.isFailure()) {
        throw result.error;
      }
      return result.value;
    };

    it("flattens variant fields to typed top-level columns", async () => {
      const rows = await run(buildQuery({ orderBy: "SPAD", orderDirection: "ASC" }));

      expect(rows).toHaveLength(3);
      expect(rows[0].SPAD).toBe(1.5);
      expect(rows[0]["Leaf Temp"]).toBe(21.0);
      expect(rows[0].macro_output).toBeUndefined();
      expect(rows[0].experiment_id).toBeUndefined();
    });

    it("leaves nested variant objects as VARIANT, not a cast-to-string", async () => {
      // Casting these to JSON/VARCHAR would report the column as STRING, and
      // an unplottable nested object would read as categorical to the pickers.
      const reader = await connection.runAndReadAll(buildQuery({ limit: 1 }));
      const metaIndex = reader.columnNames().indexOf("meta");
      expect(String(reader.columnTypes()[metaIndex])).toBe("VARIANT");
      // getRowsJson is the adapter's read path; it renders VARIANT as JSON.
      expect(reader.getRowsJson()[0][metaIndex]).toEqual({ unit: "C" });
    });

    it("routes flattened-field filters to the post-flatten WHERE", async () => {
      const rows = await run(
        buildQuery({
          filters: [{ column: "SPAD", operator: "greater_than", value: 2 }],
        }),
      );
      expect(rows.map((r) => r.SPAD).sort()).toEqual([2.5, 3.5]);
    });

    it("keeps base-column filters at the inner level", async () => {
      const rows = await run(
        buildQuery({
          filters: [{ column: "macro_id", operator: "in", value: ["m-1"] }],
        }),
      );
      expect(rows).toHaveLength(3);
    });

    it("aggregates flattened fields with time buckets", async () => {
      const rows = await run(
        buildQuery({
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "hour" }],
            functions: [{ column: "SPAD", function: "avg" }],
          },
          orderBy: "timestamp_hour",
          orderDirection: "ASC",
        }),
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].SPAD_avg).toBe(2.0);
      expect(rows[1].SPAD_avg).toBe(3.5);
    });

    it("computes grouped cumulative sums", async () => {
      const rows = await run(
        buildQuery({
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "hour" }],
            functions: [{ column: "SPAD", function: "cumsum" }],
          },
        }),
      );
      expect(rows.map((r) => r.SPAD_cumsum)).toEqual([4.0, 7.5]);
    });

    it("explodes an array column with UNNEST, which is DuckDB's LATERAL VIEW", async () => {
      // Spark's `LATERAL VIEW EXPLODE` is a parser error in DuckDB, so an
      // exploded aggregation hard-fails without the dialect override.
      const result = service.buildQuery({
        table: "macro_data",
        whereConditions: [["experiment_id", "exp-1"]],
        aggregation: {
          explode: { column: "tags", alias: "tag" },
          groupBy: [{ column: "tag", alias: "tag" }],
          functions: [{ column: "*", function: "count", alias: "row_count" }],
        },
      });
      expect(result.isSuccess()).toBe(true);
      if (result.isFailure()) throw result.error;
      expect(result.value).toContain("UNNEST");
      expect(result.value).not.toContain("LATERAL VIEW");

      const rows = await run(result.value);
      // exp-1 rows carry ['a','b'], ['b'] and ['c'], so grouping the exploded
      // elements gives one row per distinct tag and 'b' counts twice.
      const counts = new Map(rows.map((r) => [String(r.tag), Number(r.row_count)]));
      expect(Object.fromEntries(counts)).toEqual({ a: 1, b: 2, c: 1 });
    });

    it("selects distinct projected values with pagination", async () => {
      const rows = await run(
        buildQuery({
          columns: ["Leaf Temp"],
          distinct: true,
          orderBy: "Leaf Temp",
          orderDirection: "ASC",
          limit: 2,
          offset: 1,
        }),
      );
      expect(rows.map((r) => r["Leaf Temp"])).toEqual([22.0, 23.0]);
    });

    it("matches contributor pseudonyms byte-identically to the TS anonymizer", async () => {
      const { createHash } = await import("crypto");
      const pseudonym = `Contributor-${createHash("sha256")
        .update("exp-1:user-1")
        .digest("hex")
        .slice(0, 6)
        .toUpperCase()}`;

      const rows = await run(
        buildQuery({
          filters: [
            {
              column: "contributor.id",
              operator: "equals",
              value: pseudonym,
              contributorPseudonymSalt: "exp-1",
            },
          ],
        }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].SPAD).toBe(1.5);
    });

    it("yields no pseudonym match for NULL contributor ids", async () => {
      const rows = await run(
        buildQuery({
          filters: [
            {
              column: "contributor.id",
              operator: "not_equals",
              value: "Contributor-000000",
              contributorPseudonymSalt: "exp-1",
            },
          ],
        }),
      );
      // Spark concat NULL-propagation parity: the NULL-id row must not
      // satisfy the pseudonym inequality either.
      expect(rows).toHaveLength(2);
    });

    it("builds plain (non-variant) queries with EXCLUDE and pagination", async () => {
      const result = service.buildQuery({
        table: "macro_data",
        whereConditions: [["experiment_id", "exp-1"]],
        exceptColumns: ["macro_output", "contributor"],
        orderBy: "timestamp",
        orderDirection: "DESC",
        limit: 2,
        offset: 1,
      });
      expect(result.isSuccess()).toBe(true);
      if (result.isFailure()) {
        throw result.error;
      }

      const rows = await run(result.value);
      expect(rows).toHaveLength(2);
      expect(rows[0].macro_output).toBeUndefined();
      expect(String(rows[0].timestamp)).toContain("2026-01-01 10:45:00");
    });
  });
});
