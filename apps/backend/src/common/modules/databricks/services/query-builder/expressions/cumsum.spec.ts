import { SqlQueryBuilder } from "../query-builder.base";
import { buildCumsumExpression } from "./cumsum";

describe("buildCumsumExpression", () => {
  const builder = new SqlQueryBuilder();
  const orderBy = "`ts`"; // already-escaped per `buildCumsumExpression`'s contract.

  it("ungrouped with a column: SUM(col) OVER (ORDER BY …)", () => {
    const { sql, alias } = buildCumsumExpression(
      { column: "value", function: "cumsum" },
      { orderBy, grouped: false },
      builder,
    );
    expect(sql).toBe("SUM(`value`) OVER (ORDER BY `ts`)");
    expect(alias).toBe("value_cumsum");
  });

  it("grouped with a column: SUM(SUM(col)) OVER (cumulative across groups)", () => {
    const { sql } = buildCumsumExpression(
      { column: "value", function: "cumsum" },
      { orderBy, grouped: true },
      builder,
    );
    expect(sql).toBe("SUM(SUM(`value`)) OVER (ORDER BY `ts`)");
  });

  it("ungrouped with `*`: SUM(1) OVER (cumulative row count)", () => {
    const { sql, alias } = buildCumsumExpression(
      { column: "*", function: "cumsum" },
      { orderBy, grouped: false },
      builder,
    );
    expect(sql).toBe("SUM(1) OVER (ORDER BY `ts`)");
    expect(alias).toBe("count_cumsum");
  });

  it("grouped with `*`: SUM(COUNT(*)) OVER (cumulative count of groups)", () => {
    const { sql } = buildCumsumExpression(
      { column: "*", function: "cumsum" },
      { orderBy, grouped: true },
      builder,
    );
    expect(sql).toBe("SUM(COUNT(*)) OVER (ORDER BY `ts`)");
  });

  it("honours an explicit alias from the spec", () => {
    const { alias } = buildCumsumExpression(
      { column: "value", function: "cumsum", alias: "running_total" },
      { orderBy, grouped: false },
      builder,
    );
    expect(alias).toBe("running_total");
  });
});
