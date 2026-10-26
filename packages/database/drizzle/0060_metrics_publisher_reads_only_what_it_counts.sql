-- Custom SQL migration file, put your code below! --
-- The metrics publisher only counts, so it may read only the columns its counts filter on. The
-- default privileges from 0024 gave it every table created since, api_keys and passkeys among
-- them; those go, and a new table stays closed to it until a migration names its columns.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM metrics_publisher;
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM metrics_publisher;

GRANT SELECT (registered, created_at) ON TABLE "users" TO metrics_publisher;
GRANT SELECT (status, visibility, embargo_until, workbook_id, workbook_version_id, created_at, updated_at) ON TABLE "experiments" TO metrics_publisher;
GRANT SELECT (id, workbook_id, version) ON TABLE "workbook_versions" TO metrics_publisher;
GRANT SELECT (resource_type, status, created_at) ON TABLE "invitations" TO metrics_publisher;
GRANT SELECT (status, expires_at, created_at) ON TABLE "organization_invitations" TO metrics_publisher;
GRANT SELECT (status, created_at) ON TABLE "experiment_join_requests" TO metrics_publisher;
GRANT SELECT (status, created_at) ON TABLE "organization_join_requests" TO metrics_publisher;
GRANT SELECT (status, created_at) ON TABLE "iot_devices" TO metrics_publisher;
