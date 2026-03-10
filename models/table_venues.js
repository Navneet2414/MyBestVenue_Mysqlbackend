'use strict';
const CREATE_VENUES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tbl_venue (
  venue_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  businessName VARCHAR(255) NOT NULL,
  businessType VARCHAR(100) DEFAULT NULL,
  contactName VARCHAR(150) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  profilePicture VARCHAR(255) DEFAULT NULL,
  status TINYINT(1) DEFAULT 0,
  address TEXT DEFAULT NULL,
  city_id INT DEFAULT NULL,
  state_id INT DEFAULT NULL,
  country_id INT DEFAULT 1,
  pinCode VARCHAR(10) DEFAULT NULL,
  nearLocation VARCHAR(255) DEFAULT NULL,
  isApproved TINYINT(1) DEFAULT 0,
  isVerified TINYINT(1) DEFAULT 0,
  isPremium TINYINT(1) DEFAULT 0,
  isTrusted TINYINT(1) DEFAULT 0,
  description TEXT DEFAULT NULL,
  views INT DEFAULT 0,
  businessExperience INT DEFAULT NULL,
  veg_price DECIMAL(10, 2) DEFAULT NULL,
  non_veg_price DECIMAL(10, 2) DEFAULT NULL,
  veg_imfl_price DECIMAL(10, 2) DEFAULT NULL,
  non_veg_imfl_price DECIMAL(10, 2) DEFAULT NULL,
  halfday_rental_price DECIMAL(10, 2) DEFAULT NULL,
  fullday_rental_price DECIMAL(10, 2) DEFAULT NULL,
  venue_website_url VARCHAR(255) DEFAULT NULL,
  venue_facebook_url VARCHAR(255) DEFAULT NULL,
  venue_instagram_url VARCHAR(255) DEFAULT NULL,
  venue_linkedIn_url VARCHAR(255) DEFAULT NULL,
  venue_youtube_url VARCHAR(255) DEFAULT NULL,
  venueCapacity INT DEFAULT NULL,
  accountManager VARCHAR(150) DEFAULT NULL,
  advancePaymentRequired TINYINT(1) DEFAULT 0,
  alcoholServed TINYINT(1) DEFAULT 0,
  barServiceAvailable TINYINT(1) DEFAULT 0,
  bookingEngineURL VARCHAR(255) DEFAULT NULL,
  danceFloor TINYINT(1) DEFAULT 0,
  gstNumber VARCHAR(20) DEFAULT NULL,
  gstDocument VARCHAR(255) DEFAULT NULL,
  isSalesAssigned TINYINT(1) DEFAULT 0,
  leadCommitment INT DEFAULT NULL,
  liveMusicAllowed TINYINT(1) DEFAULT 0,
  metaDescription TEXT DEFAULT NULL,
  metaKeywords TEXT DEFAULT NULL,
  metaTitle VARCHAR(255) DEFAULT NULL,
  musicSystem TINYINT(1) DEFAULT 0,
  outsideLiquorPermitted TINYINT(1) DEFAULT 0,
  parking TINYINT(1) DEFAULT 0,
  premiumVenue_id BIGINT UNSIGNED DEFAULT NULL,
  otp VARCHAR(10) DEFAULT NULL,
  otpExpires BIGINT DEFAULT NULL,
  resetPasswordOtp VARCHAR(10) DEFAULT NULL,
  resetPasswordOtpExpires BIGINT DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (venue_id),
  KEY idx_email (email),
  KEY idx_phone (phone),
  KEY idx_status (status),
  KEY idx_city (city_id),
  KEY idx_isApproved (isApproved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * Execute the CREATE TABLE statement using a mysql2 connection or pool.
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureVenuesTable(connectionOrPool) {
  if (!connectionOrPool || typeof connectionOrPool.query !== 'function') {
    throw new Error('A MySQL connection or pool with a .query method is required');
  }
  await connectionOrPool.query(CREATE_VENUES_TABLE_SQL);

  // Add compatibility columns for already-created databases that predate this schema.
  const ensureColumn = async (columnName, definitionSql) => {
    const [rows] = await connectionOrPool.query(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tbl_venue'
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [columnName]
    );

    if (rows.length === 0) {
      await connectionOrPool.query(`ALTER TABLE tbl_venue ADD COLUMN ${definitionSql}`);
    }
  };

  await ensureColumn('otp', 'otp VARCHAR(10) DEFAULT NULL');
  await ensureColumn('otpExpires', 'otpExpires BIGINT DEFAULT NULL');
  await ensureColumn('resetPasswordOtp', 'resetPasswordOtp VARCHAR(10) DEFAULT NULL');
  await ensureColumn('resetPasswordOtpExpires', 'resetPasswordOtpExpires BIGINT DEFAULT NULL');
  await ensureColumn('city_id', 'city_id INT DEFAULT NULL');
  await ensureColumn('state_id', 'state_id INT DEFAULT NULL');
  await ensureColumn('country_id', 'country_id INT DEFAULT 1');
}

module.exports = {
  CREATE_VENUES_TABLE_SQL,
  ensureVenuesTable,
};
