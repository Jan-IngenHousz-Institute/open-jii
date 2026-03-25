-- Replace <EXPERIMENT_ID> with your experiment ID
-- Run BOTH queries in separate cells

-- QUERY 1: Simulate the exact pipeline expression in pure SQL
-- This replicates _group_metadata() + left join + the aggregate/transform expression
WITH grouped_meta AS (
  SELECT
    experiment_id,
    collect_list(metadata) AS _meta_records
  FROM open_jii_dev.centrum.experiment_metadata_source
  WHERE experiment_id = '<EXPERIMENT_ID>'
  GROUP BY experiment_id
)
SELECT
  variant_get(e.questions_data, '$.number', 'STRING') AS number,
  gm._meta_records IS NOT NULL AS has_meta,
  size(gm._meta_records) AS meta_count,
  aggregate(
    transform(
      gm._meta_records,
      meta -> parse_json(to_json(map_filter(
        cast(
          filter(
            cast(variant_get(meta, '$.rows', 'VARIANT') AS ARRAY<VARIANT>),
            r -> variant_get(r, concat('$.', variant_get(meta, '$.identifierColumnId', 'STRING')), 'STRING')
                 = variant_get(e.questions_data, concat('$.', variant_get(meta, '$.experimentQuestionId', 'STRING')), 'STRING')
          )[0]
          AS MAP<STRING, VARIANT>
        ),
        (k, v) -> k != '_id'
                   AND k != variant_get(meta, '$.identifierColumnId', 'STRING')
      )))
    ),
    cast(null AS variant),
    (acc, x) -> CASE
      WHEN acc IS NULL THEN x
      WHEN x IS NULL THEN acc
      ELSE parse_json(to_json(map_concat(
        cast(acc AS MAP<STRING, VARIANT>),
        cast(x AS MAP<STRING, VARIANT>)
      )))
    END
  ) AS custom_metadata
FROM open_jii_dev.centrum.enriched_experiment_raw_data e
LEFT JOIN grouped_meta gm ON e.experiment_id = gm.experiment_id
WHERE e.experiment_id = '<EXPERIMENT_ID>'
  AND variant_get(e.questions_data, '$.number', 'STRING') IN ('323', '324', '325', '326')
LIMIT 8;


-- QUERY 2: Break down the filter step to see if it matches
-- Tests the filter predicate for a single metadata record + measurement 323
SELECT
  variant_get(ms.metadata, '$.identifierColumnId', 'STRING') AS id_col,
  variant_get(ms.metadata, '$.experimentQuestionId', 'STRING') AS q_id,
  variant_get(e.questions_data, concat('$.', variant_get(ms.metadata, '$.experimentQuestionId', 'STRING')), 'STRING') AS q_value,
  size(
    filter(
      cast(variant_get(ms.metadata, '$.rows', 'VARIANT') AS ARRAY<VARIANT>),
      r -> variant_get(r, concat('$.', variant_get(ms.metadata, '$.identifierColumnId', 'STRING')), 'STRING')
           = variant_get(e.questions_data, concat('$.', variant_get(ms.metadata, '$.experimentQuestionId', 'STRING')), 'STRING')
    )
  ) AS matched_rows,
  filter(
    cast(variant_get(ms.metadata, '$.rows', 'VARIANT') AS ARRAY<VARIANT>),
    r -> variant_get(r, concat('$.', variant_get(ms.metadata, '$.identifierColumnId', 'STRING')), 'STRING')
         = variant_get(e.questions_data, concat('$.', variant_get(ms.metadata, '$.experimentQuestionId', 'STRING')), 'STRING')
  ) AS matched_row_data
FROM open_jii_dev.centrum.enriched_experiment_raw_data e
CROSS JOIN open_jii_dev.centrum.experiment_metadata_source ms
WHERE e.experiment_id = '<EXPERIMENT_ID>'
  AND ms.experiment_id = '<EXPERIMENT_ID>'
  AND variant_get(e.questions_data, '$.number', 'STRING') = '323'
LIMIT 2;
