import type { DuckDBConnection } from "@duckdb/node-api";
import { DuckDBInstance } from "@duckdb/node-api";

import { DuckDbSqlQueryBuilder } from "./duckdb-query-builder.base";
import { DuckDbQueryBuilderService } from "./duckdb-query-builder.service";

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
      expect(query).toBe('SELECT * FROM t ORDER BY "contributor"."name" DESC');
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
  });

  describe("execution against in-memory DuckDB", () => {
    let connection: DuckDBConnection;
    let service: DuckDbQueryBuilderService;

    const run = async (sql: string): Promise<Record<string, unknown>[]> => {
      const reader = await connection.runAndReadAll(sql);
      return reader.getRowObjects();
    };

    beforeAll(async () => {
      const instance = await DuckDBInstance.create(":memory:");
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
            {'id': 'user-1', 'name': 'Ada'}),
          ('exp-1', 'm-1', TIMESTAMP '2026-01-01 10:45:00',
            CAST({'SPAD': 2.5, 'Leaf Temp': 22.0, 'meta': {'unit': 'C'}} AS VARIANT),
            {'id': 'user-2', 'name': 'Grace'}),
          ('exp-1', 'm-1', TIMESTAMP '2026-01-01 11:15:00',
            CAST({'SPAD': 3.5, 'Leaf Temp': 23.0, 'meta': {'unit': 'C'}} AS VARIANT),
            {'id': NULL, 'name': NULL}),
          ('exp-2', 'm-1', TIMESTAMP '2026-01-02 09:00:00',
            CAST({'SPAD': 9.0, 'Leaf Temp': 30.0, 'meta': {'unit': 'F'}} AS VARIANT),
            {'id': 'user-3', 'name': 'Alan'})
        ) AS t(experiment_id, macro_id, "timestamp", macro_output, contributor)
      `);
    });

    const MACRO_SCHEMA = "OBJECT<SPAD: DOUBLE, `Leaf Temp`: DOUBLE, meta: OBJECT<unit: STRING>>";

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

    it("serializes nested variant objects as real JSON", async () => {
      const rows = await run(buildQuery({ limit: 1 }));
      expect(JSON.parse(String(rows[0].meta))).toEqual({ unit: "C" });
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
