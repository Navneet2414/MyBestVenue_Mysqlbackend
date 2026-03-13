'use strict';

const CREATE_VENUE_PARKING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tbl_venue_parking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venue_id INT NOT NULL,
  vehicle_type ENUM('two_wheeler', 'four_wheeler') NOT NULL,
  total_capacity INT NOT NULL,
  available_capacity INT NOT NULL,
  is_free TINYINT(1) DEFAULT 1,
  price_per_hour DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_venue_vehicle (venue_id, vehicle_type),
  KEY idx_vp_venue (venue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

/**
 * Ensure `tbl_venue_parking` exists (idempotent). Adds missing indexes where possible.
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureVenueParkingTable(connectionOrPool) {
  if (!connectionOrPool || typeof connectionOrPool.query !== 'function') {
    throw new Error('A MySQL connection or pool with a .query method is required');
  }

  await connectionOrPool.query(CREATE_VENUE_PARKING_TABLE_SQL);

  const ensureIndex = async (indexName, indexSql) => {
    const [rows] = await connectionOrPool.query(
      `SELECT 1
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tbl_venue_parking'
         AND INDEX_NAME = ?
       LIMIT 1`,
      [indexName]
    );

    if (rows.length === 0) {
      try {
        await connectionOrPool.query(indexSql);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`ensureVenueParkingTable: unable to add index ${indexName}:`, err.message || err);
      }
    }
  };

  await ensureIndex('uq_venue_vehicle', 'ALTER TABLE tbl_venue_parking ADD UNIQUE KEY uq_venue_vehicle (venue_id, vehicle_type)');
  await ensureIndex('idx_vp_venue', 'ALTER TABLE tbl_venue_parking ADD KEY idx_vp_venue (venue_id)');

  const [venueTableRows] = await connectionOrPool.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_venue'
     LIMIT 1`
  );

  if (venueTableRows.length === 0) return;

  const [venueIdRows] = await connectionOrPool.query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_venue'
       AND COLUMN_NAME = 'venue_id'
     LIMIT 1`
  );

  const [parkingVenueIdRows] = await connectionOrPool.query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_venue_parking'
       AND COLUMN_NAME = 'venue_id'
     LIMIT 1`
  );

  const venueIdType = String(venueIdRows?.[0]?.COLUMN_TYPE || '').trim();
  const parkingVenueIdType = String(parkingVenueIdRows?.[0]?.COLUMN_TYPE || '').trim();

  if (venueIdType && parkingVenueIdType && venueIdType.toLowerCase() !== parkingVenueIdType.toLowerCase()) {
    try {
      await connectionOrPool.query(
        `ALTER TABLE tbl_venue_parking MODIFY COLUMN venue_id ${venueIdType} NOT NULL`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        'ensureVenueParkingTable: unable to align tbl_venue_parking.venue_id type to tbl_venue.venue_id:',
        err.message || err
      );
    }
  }

  const [fkRows] = await connectionOrPool.query(
    `SELECT 1
     FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_venue_parking'
       AND CONSTRAINT_NAME = 'fk_vp_venue'
     LIMIT 1`
  );

  if (fkRows.length > 0) return;

  try {
    await connectionOrPool.query(
      'ALTER TABLE tbl_venue_parking ADD CONSTRAINT fk_vp_venue FOREIGN KEY (venue_id) REFERENCES tbl_venue(venue_id) ON DELETE CASCADE'
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('ensureVenueParkingTable: unable to add fk_vp_venue foreign key:', err.message || err);
  }
}

module.exports = {
  CREATE_VENUE_PARKING_TABLE_SQL,
  ensureVenueParkingTable,
};
