import type { EnrichmentSql } from "../../../../../experiments/core/models/experiment-data.model";

/**
 * The two spellings of the list and struct expressions the enrichment joins
 * need, kept side by side so a reader can diff them. The domain owns the
 * contract; only the SQL lives here, next to the builders that differ the same
 * way for `pseudonymExpression` and `starExceptClause`.
 */

/** `$.experimentQuestionId` on a blob: which measurement value selects its row. */
const SPARK_BLOB_KEY = "variant_get(meta, '$.experimentQuestionId', 'STRING')";

/**
 * The measurement value a blob matches on. A `column:` prefix selects an
 * allowlisted measurement column; anything else is a question id looked up in
 * the row's answers. An unsupported prefix resolves to NULL deliberately, so a
 * blob naming a column we do not expose matches nothing rather than everything.
 */
function sparkMatchValue(matchableColumns: string[], hasQuestionsData: boolean): string {
  const columnCases = matchableColumns.map(
    (column) =>
      `WHEN ${SPARK_BLOB_KEY} = 'column:${column}' THEN CAST(base.\`${column}\` AS STRING)`,
  );
  const answer = hasQuestionsData
    ? `variant_get(base.questions_data, concat('$.', ${SPARK_BLOB_KEY}), 'STRING')`
    : "CAST(NULL AS STRING)";

  return [
    "CASE",
    ...columnCases,
    `WHEN ${SPARK_BLOB_KEY} LIKE 'column:%' THEN CAST(NULL AS STRING)`,
    `ELSE ${answer}`,
    "END",
  ].join("\n        ");
}

export const SPARK_ENRICHMENT_SQL: EnrichmentSql = {
  emptyArray: "array()",
  concatArrays: (left, right) => `concat(${left}, ${right})`,
  struct: (fields) =>
    `named_struct(${fields.map(([name, value]) => `'${name}', ${value}`).join(", ")})`,
  sortedCollect: (inner) => `sort_array(collect_list(${inner}))`,
  castToString: (expression) => `cast(${expression} AS string)`,

  customMetadata: ({ matchableColumns, hasQuestionsData }) => ({
    // Blobs oldest-first, so the fold below lets later ones overwrite keys.
    derive:
      `(SELECT experiment_id, transform(array_sort(collect_list(named_struct(` +
      `'created_at', created_at, 'metadata_id', metadata_id, 'json', to_json(metadata)))), ` +
      `item -> parse_json(item.json)) AS meta_records ` +
      `FROM {relation} GROUP BY experiment_id)`,
    expression: `CASE WHEN enr_metadata.meta_records IS NOT NULL THEN aggregate(
        transform(
          enr_metadata.meta_records,
          meta -> parse_json(to_json(map_filter(
            cast(
              try_element_at(
                filter(
                  cast(variant_get(meta, '$.rows', 'VARIANT') as ARRAY<VARIANT>),
                  r -> variant_get(
                           r,
                           concat('$.', variant_get(meta, '$.identifierColumnId', 'STRING')),
                           'STRING'
                       ) = ${sparkMatchValue(matchableColumns, hasQuestionsData)}
                ),
                1
              ) AS MAP<STRING, VARIANT>
            ),
            (k, v) -> k != '_id'
                       AND k != variant_get(meta, '$.identifierColumnId', 'STRING')
          )))
        ),
        cast(null as variant),
        (acc, x) -> CASE
          WHEN acc IS NULL THEN x
          WHEN x IS NULL THEN acc
          ELSE parse_json(to_json(map_concat(
            map_filter(
              cast(acc AS MAP<STRING, VARIANT>),
              (k, v) -> NOT array_contains(map_keys(cast(x AS MAP<STRING, VARIANT>)), k)
            ),
            cast(x AS MAP<STRING, VARIANT>)
          )))
        END
      ) END`,
  }),
};

/** DuckDB has no map_filter; entries round-trip through a list instead. */
function duckDbDropKeys(map: string, predicate: string): string {
  return `map_from_entries(list_filter(map_entries(${map}), e -> ${predicate}))`;
}

const DUCK_BLOB_KEY = "json_extract_string(meta, '$.experimentQuestionId')";

function duckDbMatchValue(matchableColumns: string[], hasQuestionsData: boolean): string {
  const columnCases = matchableColumns.map(
    (column) => `WHEN ${DUCK_BLOB_KEY} = 'column:${column}' THEN CAST(base."${column}" AS VARCHAR)`,
  );
  const answer = hasQuestionsData
    ? `json_extract_string(CAST(base.questions_data AS JSON), '$.' || ${DUCK_BLOB_KEY})`
    : "CAST(NULL AS VARCHAR)";

  return [
    "CASE",
    ...columnCases,
    `WHEN ${DUCK_BLOB_KEY} LIKE 'column:%' THEN CAST(NULL AS VARCHAR)`,
    `ELSE ${answer}`,
    "END",
  ].join("\n        ");
}

export const DUCKDB_ENRICHMENT_SQL: EnrichmentSql = {
  emptyArray: "[]",
  // Spark's concat covers lists; DuckDB's is for strings, and its list_concat
  // is strictly typed, so the operands must already agree on element type.
  concatArrays: (left, right) => `list_concat(${left}, ${right})`,
  struct: (fields) =>
    `struct_pack(${fields.map(([name, value]) => `"${name}" := ${value}`).join(", ")})`,
  sortedCollect: (inner) => `list_sort(list(${inner}))`,
  castToString: (expression) => `CAST(${expression} AS VARCHAR)`,

  customMetadata: ({ matchableColumns, hasQuestionsData }) => ({
    // Blobs oldest-first, so the fold below lets later ones overwrite keys.
    derive:
      `(SELECT experiment_id, list_transform(` +
      `list_sort(list(struct_pack(created_at := created_at, metadata_id := metadata_id, ` +
      `json := CAST(metadata AS JSON)))), item -> item.json) AS meta_records ` +
      `FROM {relation} GROUP BY experiment_id)`,
    // The merge works in maps, but the reader flattens this column with
    // variant_extract, which needs an object variant. Casting the map straight
    // to VARIANT yields a list of key/value entries instead, so it goes
    // through JSON, which is also what the Spark twin does via to_json.
    expression: `CASE WHEN enr_metadata.meta_records IS NOT NULL THEN CAST(CAST(list_reduce(
        list_transform(
          enr_metadata.meta_records,
          meta -> ${duckDbDropKeys(
            "CAST(list_extract(list_filter(CAST(json_extract(meta, '$.rows') AS JSON[])," +
              " r -> json_extract_string(r, '$.' || json_extract_string(meta, '$.identifierColumnId'))" +
              ` = ${duckDbMatchValue(matchableColumns, hasQuestionsData)}), 1) AS MAP(VARCHAR, JSON))`,
            "e.key != '_id' AND e.key != json_extract_string(meta, '$.identifierColumnId')",
          )}
        ),
        (acc, x) -> CASE
          WHEN acc IS NULL THEN x
          WHEN x IS NULL THEN acc
          ELSE map_concat(
            ${duckDbDropKeys("acc", "NOT list_contains(map_keys(x), e.key)")},
            x
          )
        END
      ) AS JSON) AS VARIANT) END`,
  }),
};
