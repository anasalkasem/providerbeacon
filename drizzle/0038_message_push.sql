CREATE TABLE `messaging_push_devices` (
 `id` varchar(64) NOT NULL PRIMARY KEY,
 `actor` varchar(70) NOT NULL,
 `session_hash` varchar(64),
 `encrypted` text NOT NULL,
 `locale` varchar(5) NOT NULL,
 `expires_at` timestamp(3) NOT NULL,
 `queued_id` int NOT NULL DEFAULT 0,
 `sent_id` int NOT NULL DEFAULT 0,
 `next_at` timestamp(3),
 `lease` varchar(36),
 `lease_until` timestamp(3),
 `attempts` int NOT NULL DEFAULT 0,
 INDEX `push_actor_idx` (`actor`),
 INDEX `push_due_idx` (`next_at`),
 INDEX `push_expiry_idx` (`expires_at`)
);
