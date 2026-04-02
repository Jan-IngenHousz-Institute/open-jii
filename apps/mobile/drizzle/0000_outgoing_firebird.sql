CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`topic` text NOT NULL,
	`measurement_result` text NOT NULL,
	`experiment_name` text NOT NULL,
	`protocol_name` text NOT NULL,
	`timestamp` text NOT NULL,
	`created_at` integer NOT NULL
);
