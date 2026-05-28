import { SqlQueryBuilder } from "../query-builder.base";
import { QueryBuilderInputError } from "../query-builder.types";
import {
  buildAggregateExpression,
  hasAggregationContent,
  wrapWithAggregation,
} from "./aggregation";

describe("hasAggregationContent", () => {
  it("returns false for undefined / empty specs", () => {
    expect(hasAggregationContent(undefined)).toBe(false);
    expect(hasAggregationContent({})).toBe(false);
    expect(hasAggregationContent({ groupBy: [], functions: [] })).toBe(false);
  });

  it("returns true when groupBy has entries", () => {
    expect(hasAggregationContent({ groupBy: [{ column: "device" }] })).toBe(true);
  });

  it("returns true when functions has entries", () => {
    expect(hasAggregationContent({ functions: [{ column: "value", function: "avg" }] })).toBe(true);
  });
});

describe("buildAggregateExpression", () => {
  const builder = new SqlQueryBuilder();

  it.each([
    ["sum", "SUM"],
    ["avg", "AVG"],
    ["min", "MIN"],
    ["max", "MAX"],
    ["std", "STDDEV"],
    ["var", "VARIANCE"],
  ] as const)("compiles row aggregate %s to %s(col)", (fn, sqlFn) => {
    const { sql, alias } = buildAggregateExpression({ column: "value", function: fn }, builder);
    expect(sql).toBe(`${sqlFn}(\`value\`)`);
    expect(alias).toBe(`value_${fn}`);
  });

  it("compiles count(*) without escaping the wildcard", () => {
    const { sql, alias } = buildAggregateExpression({ column: "*", function: "count" }, builder);
    expect(sql).toBe("COUNT(*)");
    expect(alias).toBe("count_count");
  });

  it("compiles CORR(a, b) with both columns escaped", () => {
    const { sql, alias } = buildAggregateExpression(
      { column: "a", function: "corr", secondColumn: "b" },
      builder,
    );
    expect(sql).toBe("CORR(`a`, `b`)");
    expect(alias).toBe("a_corr_b");
  });

  it("rejects cumsum — that's the window-function path's job", () => {
    expect(() =>
      buildAggregateExpression({ column: "value", function: "cumsum" }, builder),
    ).toThrow(QueryBuilderInputError);
  });

  it("rejects corr without a secondColumn", () => {
    expect(() => buildAggregateExpression({ column: "a", function: "corr" }, builder)).toThrow(
      QueryBuilderInputError,
    );
  });

  it("honours an explicit alias from the spec", () => {
    const { alias } = buildAggregateExpression(
      { column: "value", function: "sum", alias: "total" },
      builder,
    );
    expect(alias).toBe("total");
  });
});

describe("wrapWithAggregation", () => {
  // The body assembles either a GROUP BY path or a window-only path
  // depending on the spec's content; tests pick canonical specs for each.

  it("GROUP BY path: projects groupBy + aggregates, emits GROUP BY", () => {
    const sql = wrapWithAggregation("SELECT * FROM t", {
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "value", function: "avg" }],
      },
    });
    expect(sql).toBe(
      "SELECT `device` AS `device`, AVG(`value`) AS `value_avg` FROM (SELECT * FROM t) GROUP BY `device`",
    );
  });

  it("time-bucketed groupBy projects via date_trunc + derived alias", () => {
    const sql = wrapWithAggregation("SELECT * FROM t", {
      aggregation: {
        groupBy: [{ column: "ts", timeBucket: "hour" }],
        functions: [{ column: "value", function: "sum" }],
      },
    });
    expect(sql).toContain("date_trunc('HOUR', `ts`) AS `ts_hour`");
    expect(sql).toContain("GROUP BY date_trunc('HOUR', `ts`)");
  });

  it("window-only path: preserves raw rows with SELECT *, <window>", () => {
    const sql = wrapWithAggregation("SELECT * FROM t", {
      aggregation: {
        functions: [{ column: "value", function: "cumsum" }],
      },
      orderBy: "ts",
    });
    // No groupBy, no row aggregates: keep every base column so non-
    // aggregated series can still find their values, append the cumsum.
    expect(sql).toContain("SELECT *, SUM(`value`) OVER (ORDER BY `ts`)");
    expect(sql).not.toContain("GROUP BY");
  });

  it("cumsum routes through window-only when no groupBy / orderBy given as anchor", () => {
    // With a groupBy column the cumsum anchors on the first groupBy
    // expression; without one, falls back to opts.orderBy.
    const sql = wrapWithAggregation("SELECT * FROM t", {
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "value", function: "cumsum" }],
      },
    });
    expect(sql).toContain("SUM(SUM(`value`)) OVER (ORDER BY `device`)");
  });

  it("rejects cumsum without any ordering anchor", () => {
    expect(() =>
      wrapWithAggregation("SELECT * FROM t", {
        aggregation: {
          functions: [{ column: "value", function: "cumsum" }],
        },
      }),
    ).toThrow(QueryBuilderInputError);
  });

  it("appends ORDER BY / LIMIT / OFFSET to the outer wrap", () => {
    const sql = wrapWithAggregation("SELECT * FROM t", {
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "value", function: "avg" }],
      },
      orderBy: "value_avg",
      orderDirection: "DESC",
      limit: 5,
      offset: 10,
    });
    expect(sql).toContain("ORDER BY `value_avg` DESC");
    expect(sql).toContain("LIMIT 5");
    expect(sql).toContain("OFFSET 10");
  });

  it("throws when called with empty aggregation content", () => {
    expect(() => wrapWithAggregation("SELECT * FROM t", { aggregation: {} })).toThrow(
      /without aggregation content/,
    );
  });
});
