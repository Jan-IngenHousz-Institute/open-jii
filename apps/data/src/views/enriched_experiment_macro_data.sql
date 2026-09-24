WITH
-- Macro results joined at read time with their contributor, device, annotations
-- and custom metadata as they are now. See enriched_experiment_raw_data.sql for
-- why this is a plain view. ${catalog} is filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
db_annotations AS (
  SELECT
    experiment_id,
    row_id,
    sort_array(collect_list(named_struct(
      'id', id,
      'rowId', row_id,
      'type', type,
      'content', named_struct('text', content_text, 'flagType', flag_type),
      'createdBy', user_id,
      'createdByName', user_name,
      'createdAt', created_at,
      'updatedAt', updated_at
    ))) AS annotations
  FROM ${catalog}.centrum.experiment_annotations
  GROUP BY experiment_id, row_id
),
-- Each upload's rows keyed by their identifier value, built once per upload so a
-- measurement looks its row up instead of scanning them all. The first row wins
-- when a value repeats.
metadata_rows AS (
  SELECT
    md.experiment_id,
    md.metadata_id,
    md.created_at,
    variant_get(md.metadata, '$.experimentQuestionId', 'STRING') AS question_id,
    variant_get(r.row, concat('$.', variant_get(md.metadata, '$.identifierColumnId', 'STRING')), 'STRING') AS identifier,
    map_filter(
      cast(r.row AS MAP<STRING, VARIANT>),
      (k, v) -> k != '_id' AND k != variant_get(md.metadata, '$.identifierColumnId', 'STRING')
    ) AS fields,
    r.position
  FROM ${catalog}.centrum.experiment_custom_metadata AS md
  LATERAL VIEW posexplode(cast(variant_get(md.metadata, '$.rows', 'VARIANT') AS ARRAY<VARIANT>)) r AS position, row
),
metadata_lookups AS (
  SELECT experiment_id, metadata_id, created_at, question_id,
    map_from_entries(collect_list(struct(identifier, fields))) AS lookup
  FROM (
    SELECT *, row_number() OVER (PARTITION BY experiment_id, metadata_id, identifier ORDER BY position) AS nth
    FROM metadata_rows
    WHERE identifier IS NOT NULL
  )
  WHERE nth = 1
  GROUP BY experiment_id, metadata_id, created_at, question_id
),
-- Oldest first, so a later upload replaces the keys it repeats.
metadata_records AS (
  SELECT
    experiment_id,
    array_sort(
      collect_list(named_struct('created_at', created_at, 'metadata_id', metadata_id, 'question_id', question_id, 'lookup', lookup)),
      (l, r) -> CASE
        WHEN l.created_at < r.created_at THEN -1
        WHEN l.created_at > r.created_at THEN 1
        WHEN l.metadata_id < r.metadata_id THEN -1
        WHEN l.metadata_id > r.metadata_id THEN 1
        ELSE 0
      END
    ) AS records
  FROM metadata_lookups
  GROUP BY experiment_id
),
results AS (
  SELECT
    macro.experiment_id,
    macro.id,
    macro.raw_id,
    macro.device_id,
    macro.device_name,
    macro.timestamp,
    macro.timestamp AS measurement_time_utc,
    CASE WHEN try_make_timestamp(2000, 1, 1, 0, 0, 0, macro.timezone) IS NOT NULL THEN macro.timezone END AS timezone,
    macro.date,
    contributors.user AS contributor,
    devices.device AS device,
    macro.latitude,
    macro.longitude,
    macro.macro_id,
    macro.macro_name,
    macro.macro_filename,
    macro.workbook_run_id,
    macro.macro_output,
    macro.macro_error,
    macro.processed_timestamp,
    macro.questions_data,
    macro.annotations AS payload_annotations
  FROM ${catalog}.centrum.experiment_macro_data AS macro
  LEFT JOIN ${catalog}.centrum.experiment_contributors AS contributors
    ON macro.experiment_id = contributors.experiment_id AND macro.user_id = contributors.user_id
  LEFT JOIN ${catalog}.centrum.experiment_devices AS devices
    ON macro.experiment_id = devices.experiment_id AND macro.client_id = devices.client_id
)
SELECT
  r.experiment_id,
  r.id,
  r.raw_id,
  r.device_id,
  r.device_name,
  r.timestamp,
  r.measurement_time_utc,
  r.timezone,
  r.date,
  r.contributor,
  r.device,
  r.latitude,
  r.longitude,
  r.macro_id,
  r.macro_name,
  r.macro_filename,
  r.workbook_run_id,
  r.macro_output,
  r.macro_error,
  r.processed_timestamp,
  r.questions_data,
  CASE WHEN r.timezone IS NOT NULL
    THEN date_format(from_utc_timestamp(r.measurement_time_utc, r.timezone), 'yyyy-MM-dd HH:mm:ss')
  END AS measurement_time_local,
  CASE WHEN r.timezone IS NOT NULL
    THEN date_format(from_utc_timestamp(r.measurement_time_utc, r.timezone), 'HH:mm')
  END AS local_time,
  concat(coalesce(r.payload_annotations, array()), coalesce(a.annotations, array())) AS annotations,
  -- Matched the same way as in enriched_experiment_raw_data.sql.
  CASE WHEN md.records IS NOT NULL THEN aggregate(
    transform(
      md.records,
      meta -> try_element_at(meta.lookup, CASE
        WHEN meta.question_id = 'column:device_id' THEN CAST(r.device_id AS STRING)
        WHEN meta.question_id LIKE 'column:%' THEN CAST(NULL AS STRING)
        ELSE variant_get(r.questions_data, concat('$.', meta.question_id), 'STRING')
      END)
    ),
    CAST(NULL AS MAP<STRING, VARIANT>),
    (acc, x) -> CASE
      WHEN acc IS NULL THEN x
      WHEN x IS NULL THEN acc
      ELSE map_concat(map_filter(acc, (k, v) -> NOT array_contains(map_keys(x), k)), x)
    END,
    acc -> parse_json(to_json(acc))
  ) END AS custom_metadata
FROM results AS r
LEFT JOIN db_annotations AS a
  ON CAST(r.id AS STRING) = a.row_id AND r.experiment_id = a.experiment_id
LEFT JOIN metadata_records AS md
  ON r.experiment_id = md.experiment_id
