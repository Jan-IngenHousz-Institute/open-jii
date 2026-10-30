ALTER TABLE `measurements` ADD `owner_user_id` text;--> statement-breakpoint
ALTER TABLE `measurements` ADD `owner_is_guest` integer DEFAULT false;