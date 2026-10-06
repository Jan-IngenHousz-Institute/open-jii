WITH
-- Each device's newest measurement and newest connectivity event, taken when
-- someone reads. Keyed on client_id, which equals the Thing name for X.509 registry
-- devices; Cognito publishers carry a non-Thing client_id and have no events. One
-- grouped union rather than a full outer join, so a filter on client_id reaches
-- both sources. ${catalog} is filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
activity AS (
  SELECT client_id, `timestamp` AS data_at, CAST(NULL AS STRING) AS event_type,
    CAST(NULL AS TIMESTAMP) AS event_at
  FROM ${catalog}.centrum.clean_data
  WHERE client_id IS NOT NULL
  UNION ALL
  SELECT client_id, CAST(NULL AS TIMESTAMP), event_type, event_timestamp
  FROM ${catalog}.centrum.clean_device_lifecycle_events
  WHERE client_id IS NOT NULL AND event_timestamp IS NOT NULL
)
SELECT
  client_id,
  max(data_at) AS last_data_at,
  max_by(event_type, event_at) AS last_event_type,
  max(event_at) AS last_event_at
FROM activity
GROUP BY client_id
