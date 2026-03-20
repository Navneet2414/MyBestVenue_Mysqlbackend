'use strict';

/**
 * Best-effort index creation for faster read APIs.
 * Safe to run on every boot (checks information_schema first).
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureVenueIndexes(connectionOrPool) {
  if (!connectionOrPool || typeof connectionOrPool.query !== 'function') {
    throw new Error('A MySQL connection or pool with a .query method is required');
  }

  const tableExists = async (tableName) => {
    const [rows] = await connectionOrPool.query(
      `SELECT 1
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
       LIMIT 1`,
      [tableName]
    );
    return rows.length > 0;
  };

  const ensureColumn = async (tableName, columnName, definitionSql) => {
    const [rows] = await connectionOrPool.query(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [tableName, columnName]
    );

    if (rows.length > 0) return;

    try {
      await connectionOrPool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definitionSql}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`ensureVenueIndexes: unable to add column ${tableName}.${columnName}:`, err.message || err);
    }
  };

  const ensureIndex = async (tableName, indexName, createSql) => {
    const [idxRows] = await connectionOrPool.query(
      `SELECT 1
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND INDEX_NAME = ?
       LIMIT 1`,
      [tableName, indexName]
    );

    if (idxRows.length > 0) return;

    try {
      await connectionOrPool.query(createSql);
    } catch (err) {
      // Don't crash the app if the DB user lacks privileges or the index already exists under another name.
      // eslint-disable-next-line no-console
      console.warn(`ensureVenueIndexes: unable to add ${indexName}:`, err.message || err);
    }
  };

  if (await tableExists('tbl_venue')) {
    await ensureColumn('tbl_venue', 'mongo_vendor_id', '`mongo_vendor_id` VARCHAR(24) DEFAULT NULL');

    // Columns required by the vendor migration scripts (best-effort; only adds missing columns).
    await ensureColumn('tbl_venue', 'businessType', '`businessType` VARCHAR(100) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'contactName', '`contactName` VARCHAR(150) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'email', '`email` VARCHAR(150) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'phone', '`phone` VARCHAR(20) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'password', '`password` VARCHAR(255) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'profilePicture', '`profilePicture` VARCHAR(255) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'status', '`status` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'address', '`address` TEXT DEFAULT NULL');
    await ensureColumn('tbl_venue', 'pinCode', '`pinCode` VARCHAR(10) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'nearLocation', '`nearLocation` VARCHAR(255) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'isApproved', '`isApproved` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'isVerified', '`isVerified` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'isPremium', '`isPremium` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'isTrusted', '`isTrusted` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'description', '`description` TEXT DEFAULT NULL');
    await ensureColumn('tbl_venue', 'views', '`views` INT DEFAULT 0');
    await ensureColumn('tbl_venue', 'businessExperience', '`businessExperience` INT DEFAULT NULL');

    await ensureColumn('tbl_venue', 'veg_price', '`veg_price` DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'non_veg_price', '`non_veg_price` DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'veg_imfl_price', '`veg_imfl_price` DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'non_veg_imfl_price', '`non_veg_imfl_price` DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'halfday_rental_price', '`halfday_rental_price` DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'fullday_rental_price', '`fullday_rental_price` DECIMAL(10,2) DEFAULT NULL');

    await ensureColumn('tbl_venue', 'venue_website_url', '`venue_website_url` VARCHAR(255) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'bookingEngineURL', '`bookingEngineURL` VARCHAR(255) DEFAULT NULL');

    await ensureColumn('tbl_venue', 'advancePaymentRequired', '`advancePaymentRequired` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'alcoholServed', '`alcoholServed` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'barServiceAvailable', '`barServiceAvailable` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'danceFloor', '`danceFloor` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'liveMusicAllowed', '`liveMusicAllowed` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'musicSystem', '`musicSystem` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'outsideLiquorPermitted', '`outsideLiquorPermitted` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'parking', '`parking` TINYINT(1) DEFAULT 0');

    await ensureColumn('tbl_venue', 'venueCapacity', '`venueCapacity` INT DEFAULT NULL');
    await ensureColumn('tbl_venue', 'accountManager', '`accountManager` VARCHAR(150) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'isSalesAssigned', '`isSalesAssigned` TINYINT(1) DEFAULT 0');
    await ensureColumn('tbl_venue', 'leadCommitment', '`leadCommitment` INT DEFAULT NULL');

    await ensureColumn('tbl_venue', 'metaTitle', '`metaTitle` VARCHAR(255) DEFAULT NULL');
    await ensureColumn('tbl_venue', 'metaKeywords', '`metaKeywords` TEXT DEFAULT NULL');
    await ensureColumn('tbl_venue', 'metaDescription', '`metaDescription` TEXT DEFAULT NULL');
    await ensureColumn('tbl_venue', 'faqContent', '`faqContent` TEXT DEFAULT NULL');

    await ensureIndex(
      'tbl_venue',
      'uq_venue_mongo_vendor_id',
      'ALTER TABLE tbl_venue ADD UNIQUE KEY uq_venue_mongo_vendor_id (mongo_vendor_id)'
    );
    await ensureIndex('tbl_venue', 'idx_venue_city_businessType', 'ALTER TABLE tbl_venue ADD KEY idx_venue_city_businessType (city_id, businessType)');
    await ensureIndex('tbl_venue', 'idx_venue_city_status_approved', 'ALTER TABLE tbl_venue ADD KEY idx_venue_city_status_approved (city_id, status, isApproved)');
    await ensureIndex('tbl_venue', 'idx_venue_businessType', 'ALTER TABLE tbl_venue ADD KEY idx_venue_businessType (businessType)');
    await ensureIndex('tbl_venue', 'idx_venue_updatedAt', 'ALTER TABLE tbl_venue ADD KEY idx_venue_updatedAt (updatedAt)');
  }

  if (await tableExists('tbl_venue_occasion')) {
    await ensureIndex(
      'tbl_venue_occasion',
      'idx_vo_occasion_venue',
      'ALTER TABLE tbl_venue_occasion ADD KEY idx_vo_occasion_venue (occasion_id, venue_id)'
    );
  }
}

module.exports = { ensureVenueIndexes };
