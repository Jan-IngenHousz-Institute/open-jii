ALTER TABLE "users" ADD COLUMN "admin_granted_at" timestamp;
--> statement-breakpoint
CREATE FUNCTION record_admin_appointment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
    NEW.admin_granted_at = (now() AT TIME ZONE 'UTC');
  ELSIF NEW.role IS DISTINCT FROM 'admin' THEN
    NEW.admin_granted_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER admin_appointment_date BEFORE UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION record_admin_appointment();
