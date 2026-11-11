import { QueryBuilderInputError } from "../query-builder.types";

export function timestampExpression(expression: string, rawType: string): string {
  const type = rawType.trim().toUpperCase();
  if (type === "TIMESTAMP") return expression;
  if (type !== "TIMESTAMP_NTZ" && type !== "DATE") {
    throw new QueryBuilderInputError("Time matching requires a timestamp or date column");
  }
  // DATE and NTZ carry no zone. Build a UTC instant without the session's implicit cast.
  return `make_timestamp(year(${expression}), month(${expression}), day(${expression}), ${type === "DATE" ? "0, 0, 0" : `hour(${expression}), minute(${expression}), date_part('SECOND', ${expression})`}, 'UTC')`;
}
