-- RELEASE CONSTRAINT: once this migration has run, builds predating it must be force-gated. Their outbox reuses `_client_id = id` and lacks generation CAS, so AWS IoT dedupe can suppress a replacement while the old client marks it delivered.
ALTER TABLE `measurements` ADD `delivery_generation` integer NOT NULL DEFAULT 1;
