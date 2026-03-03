CREATE TABLE `oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(50) NOT NULL,
	`account_email` varchar(255) NOT NULL,
	`refresh_token` text NOT NULL,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `oauth_tokens_id` PRIMARY KEY(`id`)
);
