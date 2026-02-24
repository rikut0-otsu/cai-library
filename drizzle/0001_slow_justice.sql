CREATE TABLE `case_studies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`thumbnail_url` text,
	`thumbnail_key` varchar(512),
	`category` enum('prompt','automation','tools','business','activation') NOT NULL,
	`tools` text NOT NULL,
	`challenge` text NOT NULL,
	`solution` text NOT NULL,
	`steps` text NOT NULL,
	`impact` text,
	`tags` text NOT NULL,
	`is_recommended` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_studies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`case_study_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `case_studies` ADD CONSTRAINT `case_studies_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_case_study_id_case_studies_id_fk` FOREIGN KEY (`case_study_id`) REFERENCES `case_studies`(`id`) ON DELETE cascade ON UPDATE no action;
