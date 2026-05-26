-- Drops the "uploading" status. In-flight state now lives in the UploadQueue
-- (Pacer AsyncQueuer), not the DB — rows previously stuck in "uploading" from
-- crashes or earlier versions are reset to "pending" so the queue re-runs them
-- on next boot.
--
-- SQLite cannot drop/replace a CHECK constraint in place, so we use the
-- standard recreate-then-copy dance. Preserves the derived columns
-- (questions_text, has_comment) added in 0002 and recreates the list-query
-- covering indexes that DROP TABLE removes.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

UPDATE `measurements` SET `status` = 'pending' WHERE `status` = 'uploading';
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
	CONSTRAINT `measurements_status_check` CHECK (`status` IN ('pending', 'failed', 'successful'))
);
--> statement-breakpoint

INSERT INTO `__new_measurements` (`id`, `status`, `topic`, `measurement_result`, `experiment_name`, `protocol_name`, `timestamp`, `created_at`, `questions_text`, `has_comment`)
SELECT `id`, `status`, `topic`, `measurement_result`, `experiment_name`, `protocol_name`, `timestamp`, `created_at`, `questions_text`, `has_comment` FROM `measurements`;
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
