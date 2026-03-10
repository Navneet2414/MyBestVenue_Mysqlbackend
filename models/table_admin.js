'use strict';

const CREATE_ADMINS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS table_admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  profilePhoto VARCHAR(500) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin') NOT NULL DEFAULT 'admin',
  otp VARCHAR(10) DEFAULT NULL,
  otpExpires BIGINT DEFAULT NULL,
  isVerified TINYINT(1) NOT NULL DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email),
  KEY idx_role (role),
  KEY idx_isVerified (isVerified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * Execute the CREATE TABLE statement using a mysql2 connection or pool.
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureAdminsTable(connectionOrPool) {
  if (!connectionOrPool || typeof connectionOrPool.query !== 'function') {
    throw new Error('A MySQL connection or pool with a .query method is required');
  }
  await connectionOrPool.query(CREATE_ADMINS_TABLE_SQL);

  // Keep existing databases compatible with OTP expiry type used in code.
  const [rows] = await connectionOrPool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'table_admins'
       AND COLUMN_NAME = 'otpExpires'
       AND DATA_TYPE = 'bigint'
     LIMIT 1`
  );

  if (rows.length === 0) {
    await connectionOrPool.query('ALTER TABLE table_admins MODIFY COLUMN otpExpires BIGINT DEFAULT NULL');
  }
}

module.exports = {
  CREATE_ADMINS_TABLE_SQL,
  ensureAdminsTable,
};
