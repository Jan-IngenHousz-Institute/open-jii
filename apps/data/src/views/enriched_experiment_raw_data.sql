WITH
-- Measurements joined at read time with their contributor, device, annotations
-- and custom metadata as they are now. A plain view stores nothing, so an edit
-- to an annotation or to custom metadata shows on the next read and nothing is
-- recomputed on a pipeline trigger. ${catalog} is filled in by terraform.
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
measurements AS (
  SELECT
    raw.experiment_id,
    raw.id,
    raw.device_id,
    raw.device_name,
    raw.timestamp,
    raw.timestamp AS measurement_time_utc,
    CASE WHEN try_make_timestamp(2000, 1, 1, 0, 0, 0, raw.timezone) IS NOT NULL THEN raw.timezone END AS timezone,
    raw.date,
    raw.macros,
    raw.questions_data,
    raw.annotations AS payload_annotations,
    contributors.user AS contributor,
    devices.device AS device,
    raw.protocol_id,
    raw.workbook_run_id,
    raw.latitude,
    raw.longitude,
    raw.data,
    raw.processed_timestamp
  FROM ${catalog}.centrum.experiment_raw_data AS raw
  LEFT JOIN ${catalog}.centrum.experiment_contributors AS contributors
    ON raw.experiment_id = contributors.experiment_id AND raw.user_id = contributors.user_id
  LEFT JOIN ${catalog}.centrum.experiment_devices AS devices
    ON raw.experiment_id = devices.experiment_id AND raw.client_id = devices.client_id
)
SELECT
  m.experiment_id,
  m.id,
  m.device_id,
  m.device_name,
  m.timestamp,
  m.measurement_time_utc,
  m.timezone,
  m.date,
  m.macros,
  m.questions_data,
  m.contributor,
  m.device,
  m.protocol_id,
  m.workbook_run_id,
  m.latitude,
  m.longitude,
  m.data,
  m.processed_timestamp,
  CASE WHEN m.timezone IS NOT NULL
    THEN date_format(from_utc_timestamp(m.measurement_time_utc, m.timezone), 'yyyy-MM-dd HH:mm:ss')
  END AS measurement_time_local,
  CASE WHEN m.timezone IS NOT NULL
    THEN date_format(from_utc_timestamp(m.measurement_time_utc, m.timezone), 'HH:mm')
  END AS local_time,
  concat(coalesce(m.payload_annotations, array()), coalesce(a.annotations, array())) AS annotations,
  -- Each upload matches a row by a question answer, or by a measurement column
  -- when experimentQuestionId is "column:<name>". The matched metadata row
  -- loses its _id and identifier keys, and later uploads win on repeated keys.
  CASE WHEN md.records IS NOT NULL THEN aggregate(
    transform(
      md.records,
      meta -> try_element_at(meta.lookup, CASE
        WHEN meta.question_id = 'column:device_id' THEN CAST(m.device_id AS STRING)
        WHEN meta.question_id LIKE 'column:%' THEN CAST(NULL AS STRING)
        ELSE variant_get(m.questions_data, concat('$.', meta.question_id), 'STRING')
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
FROM measurements AS m
LEFT JOIN db_annotations AS a
  ON CAST(m.id AS STRING) = a.row_id AND m.experiment_id = a.experiment_id
LEFT JOIN metadata_records AS md
  ON m.experiment_id = md.experiment_id
