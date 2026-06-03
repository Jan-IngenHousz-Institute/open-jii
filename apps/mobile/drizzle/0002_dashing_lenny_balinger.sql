ALTER TABLE `measurements` ADD `questions_text` text;--> statement-breakpoint
ALTER TABLE `measurements` ADD `has_comment` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_measurements_status` ON `measurements` (`status`);--> statement-breakpoint
CREATE INDEX `idx_measurements_status_ts` ON `measurements` (`status`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_measurements_created_at` ON `measurements` (`created_at`);