import type { Result } from "../../../../utils/fp-utils";
import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import { QueryBuilderService } from "./query-builder.service";

function unwrap<T>(r: Result<T>): T {
  if (r.isFailure()) throw new Error(`expected success, got: ${r.error.message}`);
  return r.value;
}

describe("QueryBuilderService", () => {
  let service: QueryBuilderService;

  beforeEach(() => {
    service = new QueryBuilderService();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("query() should return SqlQueryBuilder", () => {
    expect(service.query()).toBeInstanceOf(SqlQueryBuilder);
  });

  it("variantQuery() should return VariantQueryBuilder", () => {
    expect(service.variantQuery()).toBeInstanceOf(VariantQueryBuilder);
  });

  describe("buildQuery", () => {
    it("should build simple select query", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "users",
          columns: ["id", "name"],
          whereConditions: [["status", "active"]],
          limit: 5,
        }),
      );

      expect(sql).toBe("SELECT `id`, `name` FROM users WHERE `status` = 'active' LIMIT 5");
    });

    it("should build query with EXCEPT clause for non-variant queries", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "open_jii_dev.centrum.experiment_device_data",
          exceptColumns: ["experiment_id", "raw_data"],
          whereConditions: [["experiment_id", "d89a6dce-540c-4ac2-8b8c-516afc2bd525"]],
          orderBy: "processed_timestamp",
          orderDirection: "DESC",
          limit: 10,
          offset: 0,
        }),
      );

      expect(sql).toBe(
        "SELECT * EXCEPT (`experiment_id`, `raw_data`) FROM open_jii_dev.centrum.experiment_device_data WHERE `experiment_id` = 'd89a6dce-540c-4ac2-8b8c-516afc2bd525' ORDER BY `processed_timestamp` DESC LIMIT 10 OFFSET 0",
      );
    });

    it("drops EXCEPT when projecting explicit columns (Databricks rejects the combo)", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "my_table",
          columns: ["id", "name", "email"],
          exceptColumns: ["internal_id"],
          limit: 5,
        }),
      );

      // EXCEPT is silently dropped; the un-listed `internal_id` is
      // already excluded by virtue of not being projected.
      expect(sql).toBe("SELECT `id`, `name`, `email` FROM my_table LIMIT 5");
    });

    it("should build variant query when variants are present", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "events",
          variants: [{ columnName: "data", schema: "OBJECT<id:INT>" }],
        }),
      );

      expect(sql).toContain("try_variant_get(`data`, '$[\"id\"]', 'INT') AS `id`");
      expect(sql).not.toContain("from_json");
    });

    it("escapes quotes in variant field names inside the path literal", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "events",
          variants: [{ columnName: "data", schema: "OBJECT<`it's`: INT>" }],
        }),
      );

      expect(sql).toContain("try_variant_get(`data`, '$[\"it\\'s\"]', 'INT') AS `it's`");
    });

    it("should build variant query with exceptColumns", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "events",
          columns: ["id", "timestamp"],
          variants: [{ columnName: "payload", schema: "OBJECT<msg:STRING>" }],
          exceptColumns: ["raw_id", "internal_flag"],
        }),
      );

      // An explicit projection names its columns, so there is no star to exclude from.
      expect(sql).toBe("SELECT `id`, `timestamp`\nFROM events");
    });

    it("filters a flattened field by its extraction expression", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "events",
          variants: [
            { columnName: "custom_metadata", schema: "OBJECT<`Leaf Temperature`:DOUBLE>" },
          ],
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "Leaf Temperature", operator: "greater_than", value: 20 }],
        }),
      );

      expect(sql).toContain(
        "WHERE `experiment_id` = 'exp-1' AND " +
          "try_variant_get(`custom_metadata`, '$[\"Leaf Temperature\"]', 'DOUBLE') > 20",
      );
    });

    it("variant + flattened-field filter + aggregation: filter runs inside the aggregation wrapper", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "events",
          variants: [
            {
              columnName: "custom_metadata",
              schema: "OBJECT<`Leaf Temperature`:DOUBLE,`Ambient Temperature`:DOUBLE>",
            },
          ],
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "Leaf Temperature", operator: "greater_than", value: 50 }],
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "minute" }],
            functions: [{ column: "Ambient Temperature", function: "avg" }],
          },
        }),
      );

      // Inner: both conditions in the one WHERE, before the aggregation.
      expect(sql).toContain(
        "WHERE `experiment_id` = 'exp-1' AND " +
          "try_variant_get(`custom_metadata`, '$[\"Leaf Temperature\"]', 'DOUBLE') > 50",
      );
      // Aggregation wrapper: timestamp_minute alias + AVG(Ambient Temperature).
      expect(sql).toContain("date_trunc('MINUTE', `timestamp`) AS `timestamp_minute`");
      expect(sql).toContain("AVG(`Ambient Temperature`)");
      expect(sql).toContain("GROUP BY date_trunc('MINUTE', `timestamp`)");
    });

    it("puts base-column and flattened-field filters in the same WHERE", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "events",
          variants: [
            {
              columnName: "custom_metadata",
              schema: "OBJECT<`Leaf Temperature`:DOUBLE>",
            },
          ],
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [
            { column: "device_name", operator: "equals", value: "D1" },
            { column: "Leaf Temperature", operator: "greater_than", value: 20 },
          ],
        }),
      );

      expect(sql).toContain(
        "WHERE `experiment_id` = 'exp-1' AND `device_name` = 'D1' AND " +
          "try_variant_get(`custom_metadata`, '$[\"Leaf Temperature\"]', 'DOUBLE') > 20",
      );
      expect(sql.match(/WHERE/g)).toHaveLength(1);
    });
  });

  describe("filters and aggregation", () => {
    it("merges user filters into the inner WHERE (no wrapping)", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "catalog.centrum.raw_data",
          columns: ["timestamp", "temperature"],
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "temperature", operator: "greater_than", value: 20 }],
          orderBy: "timestamp",
          orderDirection: "ASC",
        }),
      );

      // Filters live alongside experiment_id in a single SELECT (no
      // outer wrapping), so a filter can reference any base column even
      // when `columns` projects only a subset.
      expect(sql).toBe(
        "SELECT `timestamp`, `temperature` FROM catalog.centrum.raw_data " +
          "WHERE `experiment_id` = 'exp-1' AND `temperature` > 20 " +
          "ORDER BY `timestamp` ASC",
      );
    });

    it("filters can reference columns not in the projection", () => {
      // Regression: previously the outer-wrapper path would generate
      // `SELECT * FROM (SELECT \`temperature\` FROM ...) WHERE \`other\` > 0`,
      // failing because `other` isn't in the inner projection.
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          columns: ["temperature"],
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "other", operator: "greater_than", value: 0 }],
        }),
      );

      expect(sql).toBe(
        "SELECT `temperature` FROM t WHERE `experiment_id` = 'exp-1' AND `other` > 0",
      );
    });

    it("compiles aggregation with time-bucket group-by", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "catalog.centrum.raw_data",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "hour" }],
            functions: [{ column: "temperature", function: "avg" }],
          },
          orderBy: "timestamp_hour",
        }),
      );

      expect(sql).toContain(
        "SELECT date_trunc('HOUR', `timestamp`) AS `timestamp_hour`, AVG(`temperature`) AS `temperature_avg`",
      );
      expect(sql).toContain("GROUP BY date_trunc('HOUR', `timestamp`)");
      expect(sql).toContain("ORDER BY `timestamp_hour` ASC");
    });

    it("compiles cumsum as a windowed SUM over the first groupBy expression", () => {
      // The dashboard combo-chart shape: weekly counts as bars + a
      // cumulative line on the same X axis. Cumsum's OVER (ORDER BY ...)
      // follows the time-bucket so the running total advances across
      // weeks in chronological order.
      const sql = unwrap(
        service.buildQuery({
          table: "catalog.centrum.raw_data",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "week" }],
            functions: [
              { column: "*", function: "count" },
              { column: "*", function: "cumsum", alias: "cum_count" },
            ],
          },
        }),
      );

      // Both aggregates project at the same level; the cumsum wraps the
      // group-level COUNT(*) in a window function ordered by the
      // bucketed timestamp.
      // `count_count` is the auto-derived alias for `{column: "*", function: "count"}`
      // (`${aliasBase}_${function}` with aliasBase="count" for the wildcard column).
      expect(sql).toContain("COUNT(*) AS `count_count`");
      expect(sql).toContain(
        "SUM(COUNT(*)) OVER (ORDER BY date_trunc('WEEK', `timestamp`)) AS `cum_count`",
      );
      expect(sql).toContain("GROUP BY date_trunc('WEEK', `timestamp`)");
    });

    it("compiles cumsum on a numeric column as SUM(SUM(col)) OVER (ORDER BY <groupBy>)", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            groupBy: [{ column: "day" }],
            functions: [{ column: "amount", function: "cumsum" }],
          },
        }),
      );

      expect(sql).toContain("SUM(SUM(`amount`)) OVER (ORDER BY `day`) AS `amount_cumsum`");
      expect(sql).toContain("GROUP BY `day`");
    });

    it("falls back to opts.orderBy for cumsum's window when no groupBy is set", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            // groupBy: omitted entirely; cumsum then operates on raw rows
            functions: [{ column: "amount", function: "cumsum" }],
          },
          orderBy: "timestamp",
        }),
      );

      // No grouping → inner SUM is dropped, cumsum operates row-by-row.
      expect(sql).toContain("SUM(`amount`) OVER (ORDER BY `timestamp`) AS `amount_cumsum`");
    });

    it("uses SELECT *, <window> when only window functions and no groupBy are active", () => {
      // The window-only path: a chart with one Series at "None" (raw
      // values) plus a Series with cumsum. The SQL has to project the
      // raw inner rows so the un-aggregated series's column is still
      // available for the renderer to read.
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            functions: [{ column: "amount", function: "cumsum" }],
          },
          orderBy: "timestamp",
        }),
      );

      expect(sql).toMatch(
        /^SELECT \*, SUM\(`amount`\) OVER \(ORDER BY `timestamp`\) AS `amount_cumsum`/,
      );
      expect(sql).not.toContain("GROUP BY");
    });

    it("emits explicit projections (no SELECT *) when row aggregates are also active", () => {
      // Mixing a row aggregate with a window forces GROUP BY, and the
      // SELECT must list only groupBy columns plus aggregate expressions.
      // SELECT * here would be invalid under GROUP BY semantics.
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            groupBy: [{ column: "device_id" }],
            functions: [
              { column: "total", function: "avg" },
              { column: "total", function: "cumsum" },
            ],
          },
        }),
      );

      expect(sql).not.toMatch(/^SELECT \*,/);
      expect(sql).toContain("AVG(`total`) AS `total_avg`");
      expect(sql).toContain("SUM(SUM(`total`)) OVER (ORDER BY `device_id`) AS `total_cumsum`");
      expect(sql).toContain("GROUP BY `device_id`");
    });

    it("rejects cumsum without any ordering signal as a typed input error", () => {
      // Maps to a 400 via `INVALID_QUERY_INPUT`; surfacing as a 500 was the
      // original production failure mode.
      const result = service.buildQuery({
        table: "t",
        whereConditions: [["experiment_id", "exp-1"]],
        aggregation: {
          functions: [{ column: "amount", function: "cumsum" }],
        },
      });
      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.message).toMatch(/Cumulative sum/);
        expect(result.error.code).toBe("INVALID_QUERY_INPUT");
      }
    });

    it("aggregation: filters apply pre-aggregation in the inner WHERE", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "catalog.centrum.raw_data",
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "temperature", operator: "greater_than", value: 0 }],
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "hour" }],
            functions: [{ column: "temperature", function: "avg" }],
          },
        }),
      );

      // Inner WHERE carries both experiment_id and the user filter.
      expect(sql).toContain("WHERE `experiment_id` = 'exp-1' AND `temperature` > 0");
      // Outer wraps with aggregation only.
      expect(sql).toMatch(/^SELECT date_trunc\('HOUR', `timestamp`\) AS `timestamp_hour`/);
      expect(sql).toContain("GROUP BY date_trunc('HOUR', `timestamp`)");
    });

    it("emits SQL BETWEEN for numeric and temporal range filters", () => {
      const numericSql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "temperature", operator: "between", value: [10, 30] }],
        }),
      );
      expect(numericSql).toContain("`temperature` BETWEEN 10 AND 30");

      const temporalSql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [
            {
              column: "timestamp",
              operator: "between",
              value: ["2024-01-01T00:00:00.000Z", "2024-12-31T23:59:00.000Z"],
            },
          ],
        }),
      );
      expect(temporalSql).toContain(
        "`timestamp` BETWEEN '2024-01-01T00:00:00.000Z' AND '2024-12-31T23:59:00.000Z'",
      );
    });

    it("supports all six filter operators", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [
            { column: "a", operator: "equals", value: 1 },
            { column: "b", operator: "not_equals", value: "x" },
            { column: "c", operator: "greater_than_or_equal", value: 5 },
            { column: "d", operator: "less_than_or_equal", value: 10 },
            { column: "e", operator: "contains", value: "foo" },
            { column: "f", operator: "in", value: ["a", "b"] },
          ],
        }),
      );

      expect(sql).toContain("`a` = 1");
      expect(sql).toContain("`b` <> 'x'");
      expect(sql).toContain("`c` >= 5");
      expect(sql).toContain("`d` <= 10");
      expect(sql).toContain("`e` LIKE '%foo%'");
      expect(sql).toContain("`f` IN ('a', 'b')");
    });

    it("escapes single quotes in filter values", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          filters: [{ column: "name", operator: "equals", value: "O'Brien" }],
        }),
      );

      expect(sql).toContain("`name` = 'O\\'Brien'");
    });

    it("supports COUNT(*) via column='*'", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          whereConditions: [["experiment_id", "exp-1"]],
          aggregation: {
            functions: [{ column: "*", function: "count", alias: "row_count" }],
          },
        }),
      );

      expect(sql).toContain("COUNT(*) AS `row_count`");
    });

    it("does not wrap when no filters or aggregation are supplied", () => {
      const sql = unwrap(
        service.buildQuery({
          table: "t",
          columns: ["id"],
          whereConditions: [["experiment_id", "exp-1"]],
          limit: 10,
        }),
      );

      expect(sql).toBe("SELECT `id` FROM t WHERE `experiment_id` = 'exp-1' LIMIT 10");
    });
  });

  describe("buildCountQuery", () => {
    it("should build count query", () => {
      const sql = service.buildCountQuery({
        table: "logs",
        whereClause: "level = 'ERROR'",
      });
      expect(sql).toBe("SELECT COUNT(*) FROM logs WHERE level = 'ERROR'");
    });
  });
});
