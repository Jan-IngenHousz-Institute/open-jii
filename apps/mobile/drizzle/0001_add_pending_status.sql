-- Adds the "pending" measurement status and an enforcing CHECK constraint.
--
-- SQLite cannot add a CHECK constraint to an existing column in place, so we
-- use the standard recreate-then-copy dance. Existing rows keep their current
-- status values (failed / uploading / successful) which all remain valid.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

CREATE TABLE `__new_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`topic` text NOT NULL,
	`measurement_result` text NOT NULL,
	`experiment_name` text NOT NULL,
	`protocol_name` text NOT NULL,
	`timestamp` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `measurements_status_check` CHECK (`status` IN ('pending', 'uploading', 'failed', 'successful'))
);
--> statement-breakpoint

INSERT INTO `__new_measurements` (`id`, `status`, `topic`, `measurement_result`, `experiment_name`, `protocol_name`, `timestamp`, `created_at`)
SELECT `id`, `status`, `topic`, `measurement_result`, `experiment_name`, `protocol_name`, `timestamp`, `created_at` FROM `measurements`;
--> statement-breakpoint

DROP TABLE `measurements`;
--> statement-breakpoint

ALTER TABLE `__new_measurements` RENAME TO `measurements`;
--> statement-breakpoint

PRAGMA foreign_keys = ON;
