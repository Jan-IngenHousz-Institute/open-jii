-- Macro results joined at read time with their contributor, device, annotations
-- and custom metadata as they are now. See enriched_experiment_raw_data.sql for
-- why this is a plain view. ${catalog} is filled in by terraform.
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
      meta -> parse_json(to_json(map_filter(
        cast(
          try_element_at(
            filter(
              cast(variant_get(meta, '$.rows', 'VARIANT') AS ARRAY<VARIANT>),
              candidate -> variant_get(candidate, concat('$.', variant_get(meta, '$.identifierColumnId', 'STRING')), 'STRING') =
                CASE
                  WHEN variant_get(meta, '$.experimentQuestionId', 'STRING') = 'column:device_id' THEN CAST(r.device_id AS STRING)
                  WHEN variant_get(meta, '$.experimentQuestionId', 'STRING') LIKE 'column:%' THEN CAST(NULL AS STRING)
                  ELSE variant_get(r.questions_data, concat('$.', variant_get(meta, '$.experimentQuestionId', 'STRING')), 'STRING')
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
FROM results AS r
LEFT JOIN db_annotations AS a
  ON CAST(r.id AS STRING) = a.row_id AND r.experiment_id = a.experiment_id
LEFT JOIN metadata_records AS md
  ON r.experiment_id = md.experiment_id
