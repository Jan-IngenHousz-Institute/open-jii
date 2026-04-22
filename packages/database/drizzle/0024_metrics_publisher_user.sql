-- Create the metrics_publisher user with IAM authentication for the metrics-publisher Lambda.
-- This user has read-only access to the users table and uses RDS IAM auth (no password).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'metrics_publisher') THEN
    CREATE USER metrics_publisher;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rds_iam') THEN
    EXECUTE 'GRANT rds_iam TO metrics_publisher';
  END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO metrics_publisher;
GRANT SELECT ON TABLE "users" TO metrics_publisher;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metrics_publisher;
