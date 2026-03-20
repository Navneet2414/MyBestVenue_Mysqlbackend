# Host: localhost  (Version 5.5.5-10.4.22-MariaDB)
# Date: 2026-02-26 23:50:19
# Generator: MySQL-Front 6.0  (Build 2.20)

CREATE DATABASE IF NOT EXISTS `mybestvenue` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `mybestvenue`;
SET FOREIGN_KEY_CHECKS=0;

#
# Structure for table "tbl_amenities"
#

CREATE TABLE IF NOT EXISTS `tbl_amenities` (
  `amenity_id` int(11) NOT NULL AUTO_INCREMENT,
  `amenity_name` varchar(150) NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`amenity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_amenities"
#


#
# Structure for table "tbl_city"
#

CREATE TABLE IF NOT EXISTS `tbl_city` (
  `city_id` int(11) NOT NULL AUTO_INCREMENT,
  `city_name` varchar(100) NOT NULL,
  `state_id` int(11) NOT NULL,
  `country_id` int(11) NOT NULL DEFAULT 1,
  `active` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`city_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_city"
#


#
# Structure for table "tbl_city_locality"
#

CREATE TABLE IF NOT EXISTS `tbl_city_locality` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `city_id` int(11) NOT NULL,
  `locality_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cl_city` (`city_id`),
  KEY `idx_cl_locality` (`locality_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_city_locality"
#


#
# Structure for table "tbl_country"
#

CREATE TABLE IF NOT EXISTS `tbl_country` (
  `country_id` int(11) NOT NULL AUTO_INCREMENT,
  `country_name` varchar(100) NOT NULL,
  `active` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_country"
#

INSERT IGNORE INTO `tbl_country` VALUES (1,'India',0);

#
# Structure for table "tbl_locality"
#

CREATE TABLE IF NOT EXISTS `tbl_locality` (
  `locality_id` int(11) NOT NULL AUTO_INCREMENT,
  `locality_name` varchar(150) NOT NULL,
  `active` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`locality_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_locality"
#


#
# Structure for table "tbl_occasion"
#

CREATE TABLE IF NOT EXISTS `tbl_occasion` (
  `occasion_id` int(11) NOT NULL AUTO_INCREMENT,
  `occasion_name` varchar(150) NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`occasion_id`),
  UNIQUE KEY `uq_occasion_name` (`occasion_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_occasion"
#


#
# Structure for table "tbl_state"
#

CREATE TABLE IF NOT EXISTS `tbl_state` (
  `state_id` int(11) NOT NULL AUTO_INCREMENT,
  `state_name` varchar(100) NOT NULL,
  `country_id` int(11) NOT NULL DEFAULT 1,
  `active` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`state_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_state"
#


#
# Structure for table "tbl_venue"
#

CREATE TABLE IF NOT EXISTS `tbl_venue` (
  `venue_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `mongo_vendor_id` varchar(24) DEFAULT NULL,
  `businessName` varchar(255) NOT NULL,
  `businessType` varchar(100) DEFAULT NULL,
  `contactName` varchar(150) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `profilePicture` varchar(255) DEFAULT NULL,
  `status` tinyint(1) DEFAULT 0,
  `address` text DEFAULT NULL,
  `city_id` int(11) DEFAULT NULL,
  `state_id` int(11) DEFAULT NULL,
  `country_id` int(11) DEFAULT 1,
  `pinCode` varchar(10) DEFAULT NULL,
  `nearLocation` varchar(255) DEFAULT NULL,
  `isApproved` tinyint(1) DEFAULT 0,
  `isVerified` tinyint(1) DEFAULT 0,
  `isPremium` tinyint(1) DEFAULT 0,
  `isTrusted` tinyint(1) DEFAULT 0,
  `description` text DEFAULT NULL,
  `views` int(11) DEFAULT 0,
  `businessExperience` int(11) DEFAULT NULL,
  `veg_price` decimal(10,2) DEFAULT NULL,
  `non_veg_price` decimal(10,2) DEFAULT NULL,
  `veg_imfl_price` decimal(10,2) DEFAULT NULL,
  `non_veg_imfl_price` decimal(10,2) DEFAULT NULL,
  `halfday_rental_price` decimal(10,2) DEFAULT NULL,
  `fullday_rental_price` decimal(10,2) DEFAULT NULL,
  `venue_website_url` varchar(255) DEFAULT NULL,
  `venue_facebook_url` varchar(255) DEFAULT NULL,
  `venue_instagram_url` varchar(255) DEFAULT NULL,
  `venue_linkedIn_url` varchar(255) DEFAULT NULL,
  `venue_youtube_url` varchar(255) DEFAULT NULL,
  `venueCapacity` int(11) DEFAULT NULL,
  `accountManager` varchar(150) DEFAULT NULL,
  `advancePaymentRequired` tinyint(1) DEFAULT 0,
  `alcoholServed` tinyint(1) DEFAULT 0,
  `barServiceAvailable` tinyint(1) DEFAULT 0,
  `danceFloor` tinyint(1) DEFAULT 0,
  `liveMusicAllowed` tinyint(1) DEFAULT 0,
  `musicSystem` tinyint(1) DEFAULT 0,
  `outsideLiquorPermitted` tinyint(1) DEFAULT 0,
  `parking` tinyint(1) DEFAULT 0,
  `bookingEngineURL` varchar(255) DEFAULT NULL,
  `gstNumber` varchar(20) DEFAULT NULL,
  `gstDocument` varchar(255) DEFAULT NULL,
  `isSalesAssigned` tinyint(1) DEFAULT 0,
  `leadCommitment` int(11) DEFAULT NULL,
  `metaTitle` varchar(255) DEFAULT NULL,
  `metaKeywords` text DEFAULT NULL,
  `metaDescription` text DEFAULT NULL,
  `premiumVenue_id` int(11) DEFAULT NULL,
  `faqContent` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`venue_id`),
  UNIQUE KEY `uq_venue_mongo_vendor_id` (`mongo_vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_images"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_images` (
    `image_id` int(11) NOT NULL AUTO_INCREMENT,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `image_url` varchar(500) NOT NULL,
    `title` varchar(255) DEFAULT NULL,
    `description` text DEFAULT NULL,
    `display_order` int(11) DEFAULT 0,
    `createdAt` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`image_id`),
    CONSTRAINT `fk_images_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
#
# Structure for table "tbl_venue_videos"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_videos` (
    `video_id` int(11) NOT NULL AUTO_INCREMENT,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `video_url` varchar(500) NOT NULL,
    `title` varchar(255) DEFAULT NULL,
    `description` text DEFAULT NULL,
    `display_order` int(11) DEFAULT 0,
    `createdAt` datetime DEFAULT current_timestamp(),
    PRIMARY KEY (`video_id`),
    CONSTRAINT `fk_videos_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_gst_details"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_gst_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `gst_number` varchar(20) DEFAULT NULL,
    `gst_document` varchar(255) DEFAULT NULL,
    `gst_verified` tinyint(1) DEFAULT 0,
    `createdAt` datetime DEFAULT current_timestamp(),
    `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_venue_gst` (`venue_id`),
    CONSTRAINT `fk_gst_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_venue"
#


#
# Structure for table "tbl_venue_amenities"
#

CREATE TABLE IF NOT EXISTS `tbl_venue_amenities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `venue_id` BIGINT UNSIGNED NOT NULL,
  `amenity_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_venue_amenity` (`venue_id`,`amenity_id`),
  KEY `idx_va_venue` (`venue_id`),
  KEY `idx_va_amenity` (`amenity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_venue_amenities"
#


#
# Structure for table "tbl_venue_occasion"
#

CREATE TABLE IF NOT EXISTS `tbl_venue_occasion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `venue_id` BIGINT UNSIGNED NOT NULL,
  `occasion_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_venue_occasion` (`venue_id`,`occasion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_venue_occasion"
#



#
# Structure for table "table_venue_contacts"
#
CREATE TABLE IF NOT EXISTS `table_venue_contacts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `venue_id` BIGINT UNSIGNED NOT NULL,

  `manager_name` VARCHAR(100),
  `manager_number1` VARCHAR(15),
  `manager_number2` VARCHAR(15),

  `owner_name` VARCHAR(100),
  `owner_number1` VARCHAR(15),
  `owner_number2` VARCHAR(15),

  `accountant_name` VARCHAR(100),
  `accountant_number1` VARCHAR(15),
  `accountant_number2` VARCHAR(15),

  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY `idx_contacts_venue` (`venue_id`),

  CONSTRAINT `fk_table_venue_contacts_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "table_partner_venues"
#
CREATE TABLE IF NOT EXISTS `table_partner_venues` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `leadCommitment` INT DEFAULT 0,
    `leadCompleted` INT DEFAULT 0,

    `partnership_price` DECIMAL(10,2) DEFAULT 0.00,

    `mybestvenue_manager` VARCHAR(100),
    `venue_manager` VARCHAR(100),

    `start_date` DATE,
    `end_date` DATE,

    `status` ENUM('active', 'expired', 'paused') DEFAULT 'active',

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_partner_venues_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


#
# Structure for table "table_venue_parking"
#
CREATE TABLE IF NOT EXISTS `table_venue_parking` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `two_wheeler` BOOLEAN DEFAULT FALSE,
    `four_wheeler` BOOLEAN DEFAULT FALSE,

    `total_capacity` INT DEFAULT 0,
    `available_capacity` INT DEFAULT 0,

    `is_free` BOOLEAN DEFAULT TRUE,
    `price_per_hour` DECIMAL(10,2) DEFAULT 0.00,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_venue_parking_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


#
# Structure for table "tbl_transport_modes"
#
CREATE TABLE IF NOT EXISTS `tbl_transport_modes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,

    `name` VARCHAR(50) NOT NULL UNIQUE COMMENT 'e.g. Metro, Bus, Railway, Airport',

    `status` BOOLEAN DEFAULT TRUE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "table_venue_transportation"
#
CREATE TABLE IF NOT EXISTS `table_venue_transportation` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `mode` VARCHAR(50) COMMENT 'e.g. metro, bus, railway, airport',
    `name` VARCHAR(255) COMMENT 'station/stop name',

    `distance` DECIMAL(5,2) COMMENT 'distance in km',

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_transportation_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_cuisines"
#
CREATE TABLE IF NOT EXISTS `tbl_cuisines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,

    `name` VARCHAR(100) NOT NULL UNIQUE COMMENT 'e.g. North Indian, Chinese',

    `status` BOOLEAN DEFAULT TRUE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


#
# Structure for table "tbl_rental_types"
#
CREATE TABLE IF NOT EXISTS `tbl_rental_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,

    `name` VARCHAR(100) NOT NULL UNIQUE COMMENT 'e.g. Half Day, Full Day',

    `status` BOOLEAN DEFAULT TRUE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_food_categories_types"
#
CREATE TABLE IF NOT EXISTS `tbl_food_categories_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,

    `name` VARCHAR(50) NOT NULL UNIQUE COMMENT 'e.g. Veg, Non-Veg',

    `status` BOOLEAN DEFAULT TRUE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_foodpricing"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_foodpricing` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `cuisine_id` INT NOT NULL,
    `price` INT NOT NULL COMMENT 'price per plate',

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_foodpricing_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    CONSTRAINT `fk_foodpricing_cuisine`
    FOREIGN KEY (`cuisine_id`) REFERENCES `tbl_cuisines`(`id`)
    ON DELETE CASCADE,

    UNIQUE (`venue_id`, `cuisine_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


#
# Structure for table "tbl_venue_rentalpricing"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_rentalpricing` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `type_id` INT NOT NULL,
    `price` INT NOT NULL,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_rentalpricing_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    CONSTRAINT `fk_rentalpricing_type`
    FOREIGN KEY (`type_id`) REFERENCES `tbl_rental_types`(`id`)
    ON DELETE CASCADE,

    UNIQUE (`venue_id`, `type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_food_category"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_food_category` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `category_id` INT NOT NULL,
    `price` INT NOT NULL,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_foodcategory_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    CONSTRAINT `fk_foodcategory_master`
    FOREIGN KEY (`category_id`) REFERENCES `tbl_food_categories_types`(`id`)
    ON DELETE CASCADE,

    UNIQUE (`venue_id`, `category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_food_beverage"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_food_beverage` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `catering_policy` ENUM('INHOUSE', 'OUTSIDE_ALLOWED', 'BOTH') NOT NULL,
    `soft_drink` TINYINT(1) DEFAULT 0,
    `beverage_options` TEXT,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_food_beverage_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    UNIQUE KEY `uq_food_beverage_venue` (`venue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_alcohol_policy"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_alcohol_policy` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `alcohol_served` BOOLEAN DEFAULT FALSE,
    `outside_liquor_permitted` BOOLEAN DEFAULT FALSE,
    `bar_service_available` BOOLEAN DEFAULT FALSE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_alcohol_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    UNIQUE KEY `uq_alcohol_policy_venue` (`venue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_entertainment_services"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_entertainment_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `dj_available` ENUM('INCLUDED', 'CHARGEABLE', 'NO') NOT NULL DEFAULT 'NO',

    `live_music_allowed` TINYINT(1) DEFAULT 0,
    `dance_floor_available` TINYINT(1) DEFAULT 0,
    `music_system_available` TINYINT(1) DEFAULT 0,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_entertainment_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    UNIQUE KEY `uq_entertainment_venue` (`venue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
#
# Structure for table "tbl_venue_staff_services"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_staff_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `professional_staff` BOOLEAN DEFAULT FALSE,
    `event_manager` BOOLEAN DEFAULT FALSE,
    `service_staff` BOOLEAN DEFAULT FALSE,
    `security_personnel` BOOLEAN DEFAULT FALSE,
    `waiters` BOOLEAN DEFAULT FALSE,
    `chef_team` BOOLEAN DEFAULT FALSE,
    `housekeeping` BOOLEAN DEFAULT FALSE,
    `technical_support` BOOLEAN DEFAULT FALSE,
    `security` BOOLEAN DEFAULT FALSE,
    `coordinator` BOOLEAN DEFAULT FALSE,
    `cleaning` BOOLEAN DEFAULT FALSE,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_staff_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    UNIQUE KEY `uq_staff_venue` (`venue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_venue_service_packages"
#
CREATE TABLE IF NOT EXISTS `tbl_venue_service_packages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `package_name` VARCHAR(150) NOT NULL,
    `description` TEXT,
    `service_type` VARCHAR(100) COMMENT 'e.g. farmhouse, hotel',
    `price` INT,
    `offer_price` INT,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT `fk_packages_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Structure for table "tbl_dietary_types" (Master)
#
CREATE TABLE IF NOT EXISTS `tbl_dietary_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_dietary_types"
#


#
# Structure for table "tbl_venue_dietary_options" (Mapping)
#
CREATE TABLE IF NOT EXISTS `tbl_venue_dietary_options` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `dietary_type_id` INT NOT NULL,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `fk_dietary_map_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
    ON DELETE CASCADE,

    CONSTRAINT `fk_dietary_map_type`
    FOREIGN KEY (`dietary_type_id`) REFERENCES `tbl_dietary_types`(`id`)
    ON DELETE CASCADE,

    UNIQUE (`venue_id`, `dietary_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;



-- Services Master Table
CREATE TABLE IF NOT EXISTS tbl_services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(150) NOT NULL,
    active TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Venue ↔ Services Mapping Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS tbl_venue_service_map (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venue_id BIGINT UNSIGNED NOT NULL,
    service_id INT NOT NULL,

    FOREIGN KEY (venue_id) REFERENCES tbl_venue(venue_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES tbl_services(service_id) ON DELETE CASCADE,
    UNIQUE KEY uq_venue_service (venue_id, service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Venue Policies Table
CREATE TABLE IF NOT EXISTS tbl_venue_policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venue_id BIGINT UNSIGNED NOT NULL,

    booking_policy TEXT,
    cancellation_policy TEXT,
    refund_policy TEXT,
    reschedule_policy TEXT,

    outside_decorator_policy TEXT,
    outside_photographer_policy TEXT,

    terms_conditions TEXT,
    disclaimer TEXT,

    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_policies_venue (venue_id),
    FOREIGN KEY (venue_id) REFERENCES tbl_venue(venue_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Venue Payment Table
CREATE TABLE IF NOT EXISTS `tbl_venue_payment` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `advance_payment_required` TINYINT(1) DEFAULT 0,
    `advance_percentage` INT DEFAULT NULL,

    `cash` TINYINT(1) DEFAULT 0,
    `upi` TINYINT(1) DEFAULT 0,
    `bank_transfer` TINYINT(1) DEFAULT 0,
    `cheque` TINYINT(1) DEFAULT 0,
    `credit_card` TINYINT(1) DEFAULT 0,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uq_venue_payment` (`venue_id`),
    CONSTRAINT `fk_venue_payment_venue`
        FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Venue Operating Details Table
CREATE TABLE IF NOT EXISTS `tbl_venue_operating_details` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,

    `open_time` VARCHAR(10) DEFAULT NULL,
    `close_time` VARCHAR(10) DEFAULT NULL,
    `operating_days` VARCHAR(100) DEFAULT NULL,

    `slot_morning` TINYINT(1) DEFAULT 0,
    `slot_evening` TINYINT(1) DEFAULT 0,
    `slot_full_day` TINYINT(1) DEFAULT 0,

    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uq_venue_operating` (`venue_id`),
    CONSTRAINT `fk_venue_operating_venue`
        FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tbl_additional_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `service_name` VARCHAR(150) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tbl_payment_methods` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `method_name` VARCHAR(50) UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `tbl_payment_methods` (`id`, `method_name`) VALUES
    (1, 'Cash'), (2, 'UPI'), (3, 'Bank Transfer'), (4, 'Cheque'), (5, 'Credit Card');

CREATE TABLE IF NOT EXISTS `tbl_venue_payment_methods` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `payment_method_id` INT NOT NULL,
    `is_accepted` TINYINT(1) DEFAULT 0,
    UNIQUE KEY `uq_venue_method` (`venue_id`, `payment_method_id`),
    CONSTRAINT `fk_vpm_venue` FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_vpm_method` FOREIGN KEY (`payment_method_id`) REFERENCES `tbl_payment_methods`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS `tbl_venue_additional_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `service_id` INT NOT NULL,
    `is_available` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT `fk_vas_venue`
      FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)
      ON DELETE CASCADE,

    CONSTRAINT `fk_vas_service`
      FOREIGN KEY (`service_id`) REFERENCES `tbl_additional_services`(`id`)
      ON DELETE CASCADE,

    UNIQUE KEY `unique_venue_service` (`venue_id`, `service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--  for Venue Spaces if Present Space for Venue------

CREATE TABLE IF NOT EXISTS `tbl_venue_service_areas_cities` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id` BIGINT UNSIGNED NOT NULL,
    `city_id` INT NOT NULL,
    `city_name` VARCHAR(100) NOT NULL,

    UNIQUE KEY `unique_city_mapping` (`venue_id`, `city_id`),

    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`) ON DELETE CASCADE,
    FOREIGN KEY (`city_id`) REFERENCES `tbl_city`(`city_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- for Venue Spaces if they have present
#
# Structure for table tbl_venue_spaces
#
CREATE TABLE IF NOT EXISTS `tbl_venue_spaces` (
    `space_id`              INT AUTO_INCREMENT PRIMARY KEY,
    `venue_id`              BIGINT UNSIGNED NOT NULL,
    `space_name`            VARCHAR(150) NOT NULL,
    `space_type`            ENUM('Indoor', 'Outdoor', 'Both') NOT NULL DEFAULT 'Indoor',
    `min_capacity`          INT DEFAULT NULL,
    `max_capacity`          INT DEFAULT NULL,
    `veg_price`             INT DEFAULT NULL,
    `veg_imfl_price`        INT DEFAULT NULL,
    `non_veg_price`         INT DEFAULT NULL,
    `non_veg_imfl_price`    INT DEFAULT NULL,
    `cuisine_indian`        TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_chinese`       TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_mughlai`       TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_continental`   TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_tandoori`      TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_south_indian`  TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_north_indian`  TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_italian`       TINYINT(1) NOT NULL DEFAULT 0,
    `cuisine_mexican`       TINYINT(1) NOT NULL DEFAULT 0,
    `contact_name`          VARCHAR(150) DEFAULT NULL,
    `contact_number`        CHAR(10) DEFAULT NULL,
    -- `state_id`              INT DEFAULT NULL,
    `city_id`               INT DEFAULT NULL,
    `pin_code`              CHAR(6) DEFAULT NULL,
    `near_location_id`      INT DEFAULT NULL,
    `address`               TEXT DEFAULT NULL,
    `profile_picture`       VARCHAR(500) DEFAULT NULL,
    `is_active`             TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_vs_venue` (`venue_id`),
    KEY `idx_vs_state` (`state_id`),
    FOREIGN KEY (`venue_id`) REFERENCES `tbl_venue`(`venue_id`)  ON DELETE CASCADE,
    FOREIGN KEY (`state_id`) REFERENCES `tbl_state`(`state_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

