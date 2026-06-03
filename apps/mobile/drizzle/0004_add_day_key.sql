-- Adds the derived `day_key` column (local calendar date "YYYY-MM-DD")
-- computed at save time from timestamp + resolved timezone.
-- Used to group the Recent list by day.
--
-- SQLite cannot add a non-nullable column with no default to an existing table
-- without recreating it, so we use the standard recreate-then-copy dance.
-- Sets day_key to NULL for legacy rows; backfill logic will populate them.

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
	`questions_text` text,
	`has_comment` integer DEFAULT 0 NOT NULL,
	`day_key` text,
	CONSTRAINT `measurements_status_check` CHECK (`status` IN ('pending', 'failed', 'successful'))
);
--> statement-breakpoint

INSERT INTO `__new_measurements` (`id`, `status`, `topic`, `measurement_result`, `experiment_name`, `protocol_name`, `timestamp`, `created_at`, `questions_text`, `has_comment`, `day_key`)
SELECT `id`, `status`, `topic`, `measurement_result`, `experiment_name`, `protocol_name`, `timestamp`, `created_at`, `questions_text`, `has_comment`, NULL FROM `measurements`;
--> statement-breakpoint

DROP TABLE `measurements`;
--> statement-breakpoint

ALTER TABLE `__new_measurements` RENAME TO `measurements`;
--> statement-breakpoint

CREATE INDEX `idx_measurements_status` ON `measurements` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_measurements_status_ts` ON `measurements` (`status`,`timestamp`);
--> statement-breakpoint
CREATE INDEX `idx_measurements_created_at` ON `measurements` (`created_at`);
--> statement-breakpoint

PRAGMA foreign_keys = ON;
