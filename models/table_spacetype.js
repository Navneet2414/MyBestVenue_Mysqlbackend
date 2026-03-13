'use strict';

const SPACETYPE_SEED = [
  '5 Star Hotel',
  'Art Gallery',
  'Auditorium',
  'Banquet halls',
  'Bars',
  'Business Centres',
  'Cafes',
  'Clubs',
  'Conference Rooms',
  'Farm Houses',
  'Gaming Zone',
  'Guest Houses',
  'Hotels',
  'Marriage Garden',
  'Marriage Lawn',
  'Meeting Rooms',
  'Party lawn',
  'Pool Side',
  'Pubs',
  'Resort',
  'Restaurants',
  'Roof Top',
  'Seminar Halls',
  'Training Rooms',
  'Vacation Homes',
  'Villas',
  'Wedding Hotels',
  'Wedding Resort',
];

const CREATE_SPACETYPE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tbl_spacetype (
  spacetype_id INT AUTO_INCREMENT PRIMARY KEY,
  spacetype VARCHAR(255) NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_spacetype (spacetype)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

/**
 * Execute the CREATE TABLE statement using a mysql2 connection or pool,
 * and seed initial space types (idempotent).
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureSpacetypeTable(connectionOrPool) {
  if (!connectionOrPool || typeof connectionOrPool.query !== 'function') {
    throw new Error('A MySQL connection or pool with a .query method is required');
  }

  await connectionOrPool.query(CREATE_SPACETYPE_TABLE_SQL);

  // For older DBs where the table exists but the unique index doesn't.
  const [indexRows] = await connectionOrPool.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_spacetype'
       AND INDEX_NAME = 'uq_spacetype'
     LIMIT 1`
  );

  if (indexRows.length === 0) {
    try {
      await connectionOrPool.query('ALTER TABLE tbl_spacetype ADD UNIQUE KEY uq_spacetype (spacetype)');
    } catch (err) {
      // If duplicates already exist, the ALTER may fail. Don't crash the app for this.
      // The seed insert below will still run, but may create duplicates in that scenario.
      console.warn('ensureSpacetypeTable: unable to add uq_spacetype index:', err.message || err);
    }
  }

  const rows = SPACETYPE_SEED.map((name) => [name, 1]);
  const placeholders = rows.map(() => '(?, ?)').join(', ');
  const params = rows.flat();

  // Seed / upsert (requires uq_spacetype for the update path).
  await connectionOrPool.query(
    `INSERT INTO tbl_spacetype (spacetype, active) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       active = VALUES(active),
       updated_at = CURRENT_TIMESTAMP`,
    params
  );
}

module.exports = {
  CREATE_SPACETYPE_TABLE_SQL,
  SPACETYPE_SEED,
  ensureSpacetypeTable,
};
