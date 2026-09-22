import type { EnrichmentSql } from "../../../../../experiments/core/models/experiment-data.model";

/**
 * The two spellings of the list and struct expressions the enrichment joins
 * need, kept side by side so a reader can diff them. The domain owns the
 * contract; only the SQL lives here, next to the builders that differ the same
 * way for `pseudonymExpression` and `starExceptClause`.
 */
export const SPARK_ENRICHMENT_SQL: EnrichmentSql = {
  emptyArray: "array()",
  concatArrays: (left, right) => `concat(${left}, ${right})`,
  struct: (fields) =>
    `named_struct(${fields.map(([name, value]) => `'${name}', ${value}`).join(", ")})`,
  sortedCollect: (inner) => `sort_array(collect_list(${inner}))`,
  castToString: (expression) => `cast(${expression} AS string)`,
};

export const DUCKDB_ENRICHMENT_SQL: EnrichmentSql = {
  emptyArray: "[]",
  // Spark's concat covers lists; DuckDB's is for strings, and its list_concat
  // is strictly typed, so the operands must already agree on element type.
  concatArrays: (left, right) => `list_concat(${left}, ${right})`,
  struct: (fields) =>
    `struct_pack(${fields.map(([name, value]) => `"${name}" := ${value}`).join(", ")})`,
  sortedCollect: (inner) => `list_sort(list(${inner}))`,
  castToString: (expression) => `CAST(${expression} AS VARCHAR)`,
};
