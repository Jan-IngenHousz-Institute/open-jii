-- Custom migration: Create openjii_writer database user with CRUD-only permissions
-- and enable IAM database authentication for passwordless access in AWS.
-- This migration should be run with admin/master credentials.

DO $$
BEGIN
  -- Create writer role if it doesn't exist (LOGIN, no static password needed
  -- because the backend authenticates via IAM tokens).
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'openjii_writer') THEN
    CREATE ROLE openjii_writer WITH LOGIN;
    RAISE NOTICE 'Created openjii_writer role';
  END IF;

  -- Grant the rds_iam role so this user can authenticate with IAM tokens.
  -- rds_iam is a built-in Aurora/RDS role that enables IAM database authentication.
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rds_iam') THEN
    GRANT rds_iam TO openjii_writer;
    RAISE NOTICE 'Granted rds_iam to openjii_writer';
  ELSE
    RAISE NOTICE 'rds_iam role not found — skipping (local dev environment)';
  END IF;

  -- Grant connect privilege
  EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO openjii_writer';
  
  -- Grant usage on public schema
  GRANT USAGE ON SCHEMA public TO openjii_writer;
  
  -- Grant CRUD privileges on all existing tables
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openjii_writer;
  
  -- Grant privileges on all sequences
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO openjii_writer;
  
  -- Grant default privileges for future tables created by the master/admin user
  ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openjii_writer;
  
  -- Grant default privileges for future sequences
  ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO openjii_writer;
  
  -- Grant access to drizzle schema for migration tracking (if exists)
  IF EXISTS(SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'drizzle') THEN
    GRANT USAGE ON SCHEMA drizzle TO openjii_writer;
    GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO openjii_writer;
    RAISE NOTICE 'Granted drizzle schema access to openjii_writer';
  END IF;
  
  RAISE NOTICE 'Successfully configured openjii_writer with CRUD-only permissions + IAM auth';
END $$;
