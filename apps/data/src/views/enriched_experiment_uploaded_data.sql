WITH
-- Uploaded rows joined at read time with their contributor and annotations as
-- they are now. Uploaded rows carry no question answers or device, so no custom
-- metadata can match them. ${catalog} is filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
db_annotations AS (
  SELECT
    annotation.experiment_id,
    annotation.row_id,
    sort_array(collect_list(named_struct(
      'id', annotation.id,
      'rowId', annotation.row_id,
      'type', annotation.type,
      'content', named_struct('text', annotation.content_text, 'flagType', annotation.flag_type),
      'createdBy', annotation.user_id,
      -- As pages name an author: from their profile, masked as its copy is, and none without one.
      'createdByName', nullif(trim(concat(author.first_name, ' ', author.last_name)), ''),
      'createdAt', annotation.created_at,
      'updatedAt', annotation.updated_at
    ))) AS annotations
  FROM ${catalog}.centrum.experiment_annotations AS annotation
  LEFT JOIN ${catalog}.centrum.contributor_profiles AS author ON author.user_id = annotation.user_id
  GROUP BY annotation.experiment_id, annotation.row_id
)
SELECT
  uploaded.id,
  uploaded.experiment_id,
  uploaded.upload_table_id,
  uploaded.upload_table_name,
  uploaded.upload_id,
  uploaded.uploaded_at,
  uploaded.uploaded_data,
  contributors.user AS contributor,
  -- Built by named_struct alone, its content reads NOT NULL, a type the app does not render as
  -- annotations; the other views get the nullable type from the payload's annotations.
  CAST(coalesce(a.annotations, array()) AS ARRAY<STRUCT<
    id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>,
    createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP
  >>) AS annotations,
  CAST(NULL AS VARIANT) AS custom_metadata
FROM ${catalog}.centrum.experiment_uploaded_data AS uploaded
LEFT JOIN ${catalog}.centrum.experiment_contributors AS contributors
  ON uploaded.experiment_id = contributors.experiment_id AND uploaded.created_by = contributors.user_id
LEFT JOIN db_annotations AS a
  ON CAST(uploaded.id AS STRING) = a.row_id AND uploaded.experiment_id = a.experiment_id
