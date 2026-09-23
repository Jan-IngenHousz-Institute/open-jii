-- Measurements joined at read time with their contributor, device, annotations
-- and custom metadata as they are now. A plain view stores nothing, so an edit
-- to an annotation or to custom metadata shows on the next read and nothing is
-- recomputed on a pipeline trigger. ${catalog} is filled in by terraform.
WITH db_annotations AS (
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
-- Oldest first, so a later upload replaces the keys it repeats.
metadata_records AS (
  SELECT
    experiment_id,
    transform(
      array_sort(collect_list(named_struct(
        'created_at', created_at,
        'metadata_id', metadata_id,
        'json', to_json(metadata)
      ))),
      item -> parse_json(item.json)
    ) AS records
  FROM ${catalog}.centrum.experiment_custom_metadata
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
      meta -> parse_json(to_json(map_filter(
        cast(
          try_element_at(
            filter(
              cast(variant_get(meta, '$.rows', 'VARIANT') AS ARRAY<VARIANT>),
              candidate -> variant_get(candidate, concat('$.', variant_get(meta, '$.identifierColumnId', 'STRING')), 'STRING') =
                CASE
                  WHEN variant_get(meta, '$.experimentQuestionId', 'STRING') = 'column:device_id' THEN CAST(m.device_id AS STRING)
                  WHEN variant_get(meta, '$.experimentQuestionId', 'STRING') LIKE 'column:%' THEN CAST(NULL AS STRING)
                  ELSE variant_get(m.questions_data, concat('$.', variant_get(meta, '$.experimentQuestionId', 'STRING')), 'STRING')
                END
            ),
            1
          ) AS MAP<STRING, VARIANT>
        ),
        (k, v) -> k != '_id' AND k != variant_get(meta, '$.identifierColumnId', 'STRING')
      )))
    ),
    CAST(NULL AS VARIANT),
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
  ) END AS custom_metadata
FROM measurements AS m
LEFT JOIN db_annotations AS a
  ON CAST(m.id AS STRING) = a.row_id AND m.experiment_id = a.experiment_id
LEFT JOIN metadata_records AS md
  ON m.experiment_id = md.experiment_id
