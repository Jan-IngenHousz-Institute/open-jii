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
CREATE FUNCTION refuse_guest_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND NOT is_anonymous) THEN
    RAISE EXCEPTION 'Guests cannot hold organization memberships' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guest_membership_refused BEFORE INSERT OR UPDATE OF user_id ON organization_members
FOR EACH ROW EXECUTE FUNCTION refuse_guest_membership();
--> statement-breakpoint
CREATE FUNCTION refuse_becoming_guest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_anonymous AND NOT OLD.is_anonymous THEN
    RAISE EXCEPTION 'A registered account cannot become a guest' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guest_identity_one_way BEFORE UPDATE OF is_anonymous ON users
FOR EACH ROW EXECUTE FUNCTION refuse_becoming_guest();
