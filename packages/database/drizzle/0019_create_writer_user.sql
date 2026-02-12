-- Custom migration: Create openjii_writer database user with CRUD-only permissions
-- This migration should be run with admin/master credentials
-- The actual password will be managed by AWS Secrets Manager in production

DO $$
DECLARE
  writer_password TEXT;
BEGIN
  -- Get password from environment or use placeholder
  -- In production, this will be replaced by the actual password from Secrets Manager
  writer_password := COALESCE(
    current_setting('app.writer_password', true),
    'PLACEHOLDER_WILL_BE_SET_BY_SCRIPT'
  );

  -- Create writer role if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'openjii_writer') THEN
    EXECUTE format('CREATE ROLE openjii_writer WITH LOGIN PASSWORD %L', writer_password);
    RAISE NOTICE 'Created openjii_writer role';
  ELSE
    -- Update password if user exists
    EXECUTE format('ALTER USER openjii_writer WITH PASSWORD %L', writer_password);
    RAISE NOTICE 'Updated openjii_writer password';
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
  
  RAISE NOTICE 'Successfully configured openjii_writer with CRUD-only permissions';
END $$;
