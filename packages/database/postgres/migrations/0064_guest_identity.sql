CREATE TABLE "guest_usage" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "guest_usage_user_id_kind_window_start_pk" PRIMARY KEY("user_id","kind","window_start")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_usage" ADD CONSTRAINT "guest_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION lock_guest_membership_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    PERFORM pg_advisory_xact_lock(2230);
  ELSIF NEW.is_anonymous THEN
    PERFORM pg_advisory_xact_lock(2230);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guest_identity_lock BEFORE INSERT OR UPDATE OF is_anonymous ON users
FOR EACH ROW EXECUTE FUNCTION lock_guest_membership_changes();
--> statement-breakpoint
CREATE TRIGGER guest_organization_lock BEFORE INSERT OR UPDATE OF type ON organizations
FOR EACH ROW EXECUTE FUNCTION lock_guest_membership_changes();
--> statement-breakpoint
CREATE FUNCTION admit_new_guest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_anonymous THEN
    INSERT INTO organization_members (organization_id, user_id, role)
      SELECT id, NEW.id, 'member' FROM organizations WHERE type::text = 'demo'
      ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guest_demo_memberships AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION admit_new_guest();
--> statement-breakpoint
CREATE FUNCTION synchronize_demo_guests() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type::text = 'demo' THEN
    INSERT INTO organization_members (organization_id, user_id, role)
      SELECT NEW.id, id, 'member' FROM users WHERE is_anonymous
      ON CONFLICT (organization_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM organization_members WHERE organization_id = NEW.id
      AND user_id IN (SELECT id FROM users WHERE is_anonymous);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER demo_guest_memberships AFTER INSERT OR UPDATE OF type ON organizations
FOR EACH ROW EXECUTE FUNCTION synchronize_demo_guests();
--> statement-breakpoint
CREATE FUNCTION enforce_guest_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND is_anonymous) THEN
    PERFORM pg_advisory_xact_lock(2230);
    IF NEW.role <> 'member' OR NOT EXISTS (
      SELECT 1 FROM organizations WHERE id = NEW.organization_id AND type::text = 'demo'
    ) THEN
      RAISE EXCEPTION 'Guests can only be members of Demo organizations' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guest_membership_scope BEFORE INSERT OR UPDATE ON organization_members
FOR EACH ROW EXECUTE FUNCTION enforce_guest_membership();
