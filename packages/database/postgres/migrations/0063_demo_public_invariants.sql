CREATE FUNCTION enforce_demo_organization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type::text = 'demo' THEN
    IF NEW.visibility::text <> 'public' OR NEW.slug LIKE 'personal-%' THEN
      RAISE EXCEPTION 'Demo organizations must be public and cannot be personal workspaces' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.type::text IS DISTINCT FROM 'demo' THEN
      -- A private resource write holds FOR KEY SHARE on its organization until it commits, so
      -- this waits for every such write in flight, and the check below then sees it.
      PERFORM 1 FROM organizations WHERE id = NEW.id FOR UPDATE;
      IF EXISTS (SELECT 1 FROM experiments WHERE organization_id = NEW.id AND visibility::text = 'private')
        OR EXISTS (SELECT 1 FROM workbooks WHERE organization_id = NEW.id AND visibility::text = 'private')
        OR EXISTS (SELECT 1 FROM protocols WHERE organization_id = NEW.id AND visibility::text = 'private')
        OR EXISTS (SELECT 1 FROM macros WHERE organization_id = NEW.id AND visibility::text = 'private') THEN
        RAISE EXCEPTION 'Publish every experiment, workbook, protocol and macro before choosing Demo' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER demo_organization_public BEFORE INSERT OR UPDATE OF type, visibility, slug ON organizations
FOR EACH ROW EXECUTE FUNCTION enforce_demo_organization();
--> statement-breakpoint
CREATE FUNCTION enforce_demo_resource() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  organization_type text;
BEGIN
  IF NEW.organization_id IS NOT NULL AND NEW.visibility::text <> 'public' THEN
    -- The lock a foreign key check already takes: resource writes never wait on each other,
    -- and a conversion to Demo waits for this write or this write for the conversion.
    SELECT type::text INTO organization_type FROM organizations
      WHERE id = NEW.organization_id FOR KEY SHARE;
    IF organization_type = 'demo' THEN
      RAISE EXCEPTION 'Demo organizations can only own public resources' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER demo_experiment_public BEFORE INSERT OR UPDATE OF organization_id, visibility ON experiments
FOR EACH ROW EXECUTE FUNCTION enforce_demo_resource();
--> statement-breakpoint
CREATE TRIGGER demo_workbook_public BEFORE INSERT OR UPDATE OF organization_id, visibility ON workbooks
FOR EACH ROW EXECUTE FUNCTION enforce_demo_resource();
--> statement-breakpoint
CREATE TRIGGER demo_protocol_public BEFORE INSERT OR UPDATE OF organization_id, visibility ON protocols
FOR EACH ROW EXECUTE FUNCTION enforce_demo_resource();
--> statement-breakpoint
CREATE TRIGGER demo_macro_public BEFORE INSERT OR UPDATE OF organization_id, visibility ON macros
FOR EACH ROW EXECUTE FUNCTION enforce_demo_resource();
