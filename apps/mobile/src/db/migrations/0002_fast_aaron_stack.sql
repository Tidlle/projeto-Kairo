CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`task_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
