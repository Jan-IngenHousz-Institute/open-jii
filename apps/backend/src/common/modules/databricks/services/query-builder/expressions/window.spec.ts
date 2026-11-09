import { SqlQueryBuilder } from "../query-builder.base";
import { QueryBuilderInputError } from "../query-builder.types";
import { buildRowWindowExpression, buildWindowSpec } from "./window";

describe("raw row windows", () => {
  const builder = new SqlQueryBuilder(["id", "sensor.id", "timestamp", "value"]);
  const item = { column: "value", function: "previous" as const, orderColumn: "timestamp" };

  it("orders within a partition and breaks timestamp ties with the row id", () => {
    expect(
      buildWindowSpec({ ...item, partitionColumn: "sensor.id", tieBreaker: "id" }, builder),
    ).toBe("PARTITION BY `sensor.id` ORDER BY `timestamp` ASC, `id` ASC");
    expect(buildWindowSpec(item, builder)).toBe("ORDER BY `timestamp` ASC");
    expect(buildWindowSpec({ ...item, orderColumn: "id", tieBreaker: "id" }, builder)).toBe(
      "ORDER BY `id` ASC",
    );
  });

  it("keeps the previous raw value, including null, and defaults its alias", () => {
    expect(buildRowWindowExpression(item, builder)).toEqual({
      sql: "LAG(`value`) OVER (ORDER BY `timestamp` ASC)",
      alias: "value_previous",
    });
  });

  it("numbers every row without reading its value column", () => {
    expect(
      buildRowWindowExpression({ ...item, column: "*", function: "row_number" }, builder),
    ).toEqual({
      sql: "ROW_NUMBER() OVER (ORDER BY `timestamp` ASC)",
      alias: "*_row_number",
    });
  });

  it.each(["DOUBLE", "INT", "decimal(12, 4)"])(
    "subtracts numeric %s values without timestamp coercion",
    (valueType) => {
      expect(
        buildRowWindowExpression({ ...item, function: "change_from_previous", valueType }, builder)
          .sql,
      ).toBe("(`value` - LAG(`value`) OVER (ORDER BY `timestamp` ASC))");
    },
  );

  it("converts timestamp microseconds to seconds after subtracting", () => {
    expect(
      buildRowWindowExpression(
        { ...item, function: "change_from_previous", valueType: "TIMESTAMP", tieBreaker: "id" },
        builder,
      ).sql,
    ).toBe(
      "(unix_micros(`value`) - unix_micros(LAG(`value`) OVER (ORDER BY `timestamp` ASC, `id` ASC))) / 1e6",
    );
  });

  it.each([
    ["DATE", "0, 0, 0"],
    ["TIMESTAMP_NTZ", "hour(`value`), minute(`value`), date_part('SECOND', `value`)"],
  ])("interprets %s without the warehouse session timezone", (valueType, clock) => {
    const instant = `make_timestamp(year(\`value\`), month(\`value\`), day(\`value\`), ${clock}, 'UTC')`;
    expect(
      buildRowWindowExpression({ ...item, function: "change_from_previous", valueType }, builder)
        .sql,
    ).toBe(
      `(unix_micros(${instant}) - unix_micros(LAG(${instant}) OVER (ORDER BY \`timestamp\` ASC))) / 1e6`,
    );
  });

  it("leaves unresolved input types to warehouse column resolution", () => {
    expect(
      buildRowWindowExpression(
        { ...item, column: "removed", function: "change_from_previous" },
        builder,
      ).sql,
    ).toBe("(`removed` - LAG(`removed`) OVER (ORDER BY `timestamp` ASC))");
  });

  it.each(["STRING", "BOOLEAN", "STRUCT<a: INT>"])(
    "rejects unsupported difference input %s",
    (valueType) => {
      expect(() =>
        buildRowWindowExpression({ ...item, function: "change_from_previous", valueType }, builder),
      ).toThrow(QueryBuilderInputError);
    },
  );

  it("requires an ordering column even when contract validation is bypassed", () => {
    expect(() => buildWindowSpec({ column: "value", function: "previous" }, builder)).toThrow(
      QueryBuilderInputError,
    );
  });
});
