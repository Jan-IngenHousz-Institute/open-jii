import { SqlQueryBuilder } from "../query-builder.base";
import { buildWidthBucketExpression } from "./width-bucket";

describe("buildWidthBucketExpression", () => {
  const builder = new SqlQueryBuilder();

  it("buckets a timestamp column by its epoch milliseconds", () => {
    const { sql, alias } = buildWidthBucketExpression(
      "timestamp",
      { origin: 1_758_000_000_000, width: 60_000, scale: "time" },
      builder,
    );
    expect(sql).toBe("FLOOR((UNIX_MILLIS(`timestamp`) - 1758000000000) / 60000)");
    expect(alias).toBe("timestamp_bucket");
  });

  it("buckets a numeric column by its value", () => {
    const { sql } = buildWidthBucketExpression(
      "depth cm",
      { origin: -2.5, width: 0.25, scale: "number" },
      builder,
    );
    expect(sql).toBe("FLOOR((`depth cm` - -2.5) / 0.25)");
  });

  it("takes an explicit alias for a column whose name is not a valid identifier", () => {
    const { alias } = buildWidthBucketExpression(
      "data.time",
      { origin: 0, width: 1, scale: "number" },
      builder,
      "data_time_bucket",
    );
    expect(alias).toBe("data_time_bucket");
  });
});
