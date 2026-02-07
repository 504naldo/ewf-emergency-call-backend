ALTER TABLE `incidents` ADD `source` enum('telephony','manual') DEFAULT 'telephony' NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `createdByUserId` int;