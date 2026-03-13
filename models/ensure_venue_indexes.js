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
