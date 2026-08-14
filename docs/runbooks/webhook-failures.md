# webhook-failures

HMAC-authenticated webhook traffic between Databricks and the backend is failing (rejections or 5xx), in either direction.

Likely causes: webhook secret/key-id rotation applied on one side only; clock skew breaking the timestamp replay window; backend deploy changed a contract the pipeline calls.

First moves: backend logs for HmacGuard rejection reason (bad key id vs bad signature vs stale timestamp); Databricks side: backend_client failures in pipeline/task logs; confirm secret scope values match.
