# Host: localhost  (Version 5.5.5-10.4.22-MariaDB)
# Date: 2026-02-26 23:50:19
# Generator: MySQL-Front 6.0  (Build 2.20)


#
# Structure for table "tbl_amenities"
#

CREATE TABLE `tbl_amenities` (
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

CREATE TABLE `tbl_city` (
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

CREATE TABLE `tbl_city_locality` (
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

CREATE TABLE `tbl_country` (
  `country_id` int(11) NOT NULL AUTO_INCREMENT,
  `country_name` varchar(100) NOT NULL,
  `active` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`country_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_country"
#

INSERT INTO `tbl_country` VALUES (1,'India',0);

#
# Structure for table "tbl_locality"
#

CREATE TABLE `tbl_locality` (
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

CREATE TABLE `tbl_occasion` (
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

CREATE TABLE `tbl_state` (
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

CREATE TABLE `tbl_venue` (
  `venue_id` int(11) NOT NULL AUTO_INCREMENT,
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
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`venue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_venue"
#


#
# Structure for table "tbl_venue_amenities"
#

CREATE TABLE `tbl_venue_amenities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `venue_id` int(11) NOT NULL,
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

CREATE TABLE `tbl_venue_occasion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `venue_id` int(11) NOT NULL,
  `occasion_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_venue_occasion` (`venue_id`,`occasion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

#
# Data for table "tbl_venue_occasion"
#

