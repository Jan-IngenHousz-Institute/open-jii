import { SqlQueryBuilder } from "../query-builder.base";
import { buildTimeBucketExpression } from "./time-bucket";

describe("buildTimeBucketExpression", () => {
  const builder = new SqlQueryBuilder();

  it("emits an upper-cased date_trunc call and a derived alias", () => {
    const { sql, alias } = buildTimeBucketExpression("created_at", "hour", builder);
    expect(sql).toBe("date_trunc('HOUR', `created_at`)");
    expect(alias).toBe("created_at_hour");
  });

  it("escapes the column identifier", () => {
    const { sql } = buildTimeBucketExpression("My Time", "day", builder);
    expect(sql).toBe("date_trunc('DAY', `My Time`)");
  });

  it("derives alias from raw column name (no escaping)", () => {
    // Alias is consumed by callers as a JS identifier, not re-rendered
    // back into SQL, so it stays in raw form here.
    const { alias } = buildTimeBucketExpression("timestamp", "month", builder);
    expect(alias).toBe("timestamp_month");
  });
});
