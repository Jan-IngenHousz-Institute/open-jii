ALTER TABLE `measurements` ADD `record_kind` text;
--> statement-breakpoint
CREATE INDEX `idx_measurements_record_kind` ON `measurements` (`record_kind`);
