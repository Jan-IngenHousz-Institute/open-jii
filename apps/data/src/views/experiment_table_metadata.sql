WITH
-- Each experiment table's schemas from the pipeline and a fingerprint of them, with
-- its row count, when its newest data arrived and an upload's newest name, taken when
-- someone reads. A macro result carries its source measurement's arrival time. A count
-- cannot be kept incrementally on classic compute, and the gold tables are clustered
-- by experiment, so a read scans only the experiment it asks for. ${catalog} is
-- filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
tables_now AS (
  SELECT experiment_id, 'static' AS table_type, 'raw_data' AS identifier,
    CAST(NULL AS STRING) AS display_name, count(*) AS row_count,
    max(processed_timestamp) AS latest_row_at
  FROM ${catalog}.centrum.experiment_raw_data
  GROUP BY experiment_id
  UNION ALL
  SELECT experiment_id, 'static', 'device', CAST(NULL AS STRING), count(*),
    CAST(NULL AS TIMESTAMP)
  FROM ${catalog}.centrum.experiment_device_data
  GROUP BY experiment_id
  UNION ALL
  SELECT experiment_id, 'macro', macro_id, CAST(NULL AS STRING), count(*),
    max(processed_timestamp)
  FROM ${catalog}.centrum.experiment_macro_data
  GROUP BY experiment_id, macro_id
  UNION ALL
  -- The newest upload names the table, so a rename shows once it is uploaded.
  SELECT experiment_id, 'upload', upload_table_id,
    max(struct(uploaded_at, upload_table_name)).upload_table_name, count(*),
    max(uploaded_at)
  FROM ${catalog}.centrum.experiment_uploaded_data
  GROUP BY experiment_id, upload_table_id
)
SELECT
  metadata.experiment_id,
  metadata.identifier,
  metadata.table_type,
  tables_now.display_name,
  tables_now.row_count,
  tables_now.latest_row_at,
  metadata.macro_schema,
  metadata.questions_schema,
  metadata.custom_metadata_schema,
  metadata.upload_schema,
  -- The schemas refresh apart from the counts, so a reader polling the counts
  -- also needs this to notice a column that arrived after its row.
  md5(concat_ws('|',
    coalesce(metadata.macro_schema, ''),
    coalesce(metadata.questions_schema, ''),
    coalesce(metadata.custom_metadata_schema, ''),
    coalesce(metadata.upload_schema, '')
  )) AS schema_revision
FROM ${catalog}.centrum.experiment_table_metadata AS metadata
LEFT JOIN tables_now
  ON metadata.experiment_id = tables_now.experiment_id
  AND metadata.table_type = tables_now.table_type
  AND metadata.identifier = tables_now.identifier
