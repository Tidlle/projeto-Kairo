CREATE TABLE `sync_state` (
	`table_name` text PRIMARY KEY NOT NULL,
	`last_pushed_at` text,
	`last_pulled_at` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "name", "balance_cents", "created_at", "updated_at") SELECT "id", "name", "balance_cents", "created_at", "updated_at" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_due_items` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_due_items`("id", "label", "amount_cents", "due_date", "created_at", "updated_at") SELECT "id", "label", "amount_cents", "due_date", "created_at", "updated_at" FROM `due_items`;--> statement-breakpoint
DROP TABLE `due_items`;--> statement-breakpoint
ALTER TABLE `__new_due_items` RENAME TO `due_items`;--> statement-breakpoint
CREATE TABLE `__new_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_cents` integer NOT NULL,
	`saved_cents` integer DEFAULT 0 NOT NULL,
	`monthly_contribution_cents` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_goals`("id", "name", "target_cents", "saved_cents", "monthly_contribution_cents", "status", "created_at", "updated_at") SELECT "id", "name", "target_cents", "saved_cents", "monthly_contribution_cents", "status", "created_at", "updated_at" FROM `goals`;--> statement-breakpoint
DROP TABLE `goals`;--> statement-breakpoint
ALTER TABLE `__new_goals` RENAME TO `goals`;--> statement-breakpoint
CREATE TABLE `__new_habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_habit_logs`("id", "habit_id", "date", "created_at", "updated_at") SELECT "id", "habit_id", "date", "created_at", "updated_at" FROM `habit_logs`;--> statement-breakpoint
DROP TABLE `habit_logs`;--> statement-breakpoint
ALTER TABLE `__new_habit_logs` RENAME TO `habit_logs`;--> statement-breakpoint
CREATE TABLE `__new_habits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`target_per_period` integer DEFAULT 1 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_habits`("id", "name", "frequency", "target_per_period", "current_streak", "best_streak", "created_at", "updated_at") SELECT "id", "name", "frequency", "target_per_period", "current_streak", "best_streak", "created_at", "updated_at" FROM `habits`;--> statement-breakpoint
DROP TABLE `habits`;--> statement-breakpoint
ALTER TABLE `__new_habits` RENAME TO `habits`;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`due_at` text,
	`estimated_cost_cents` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "status", "priority", "due_at", "estimated_cost_cents", "created_at", "updated_at") SELECT "id", "title", "status", "priority", "due_at", "estimated_cost_cents", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;