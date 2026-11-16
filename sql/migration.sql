-- ============================================================
-- Tabel jembatan Bot Discord <-> Gamemode (aman dijalankan berulang)
-- Bot membuat tabel ini otomatis; gamemode juga membuatnya saat server start
-- (BotBridge_Init). File ini hanya untuk jaga-jaga / manual.
-- TIDAK ada perubahan pada player_ucp / whitelists.
-- ============================================================

CREATE TABLE IF NOT EXISTS `discord_actions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `action` VARCHAR(16) NOT NULL,
  `target_name` VARCHAR(32) NOT NULL,
  `minutes` INT NOT NULL DEFAULT 0,
  `amount` INT NOT NULL DEFAULT 0,
  `days` INT NOT NULL DEFAULT 0,
  `reason` VARCHAR(128) NOT NULL DEFAULT '-',
  `admin` VARCHAR(64) NOT NULL DEFAULT 'Discord',
  `status` TINYINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gamelogs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `type` VARCHAR(16) NOT NULL,
  `actor` VARCHAR(64) NOT NULL DEFAULT '-',
  `target` VARCHAR(64) NOT NULL DEFAULT '-',
  `amount` BIGINT NOT NULL DEFAULT 0,
  `amount2` BIGINT NOT NULL DEFAULT 0,
  `info` VARCHAR(64) NOT NULL DEFAULT '',
  `reason` VARCHAR(128) NOT NULL DEFAULT '-',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `moneylogs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(32) NOT NULL,
  `amount` BIGINT NOT NULL,
  `balance` BIGINT NOT NULL DEFAULT 0,
  `reason` VARCHAR(128) NOT NULL DEFAULT '-',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `familieslogs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `Name` VARCHAR(64) NOT NULL DEFAULT '',
  `UCP` VARCHAR(32) NOT NULL DEFAULT '',
  `Activity` VARCHAR(255) NOT NULL DEFAULT '',
  `Time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Families` VARCHAR(64) NOT NULL DEFAULT '',
  KEY `idx_fam` (`Families`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
