const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbHost = process.env.DB_HOST ?? 'localhost';
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER ?? process.env.DB_USERNAME ?? 'root';
const dbPassword = process.env.DB_PASSWORD ?? '';
const dbName = process.env.DB_NAME ?? process.env.DB_DATABASE;

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
});

const getConnection = () => pool.getConnection();
const query = (...args) => pool.query(...args);
const execute = (...args) => pool.execute(...args);

const init = async () => {
  let conn;
  try {
    if (!dbName) {
      throw new Error('Database name is missing. Set DB_NAME (or DB_DATABASE) in .env');
    }
    conn = await pool.getConnection();
    await conn.ping();
    console.log('MySQL connected');
  } catch (err) {
    console.error(
      `Unable to connect to MySQL (${dbHost}:${dbPort}/${dbName || 'no_db'}):`,
      err.message || err
    );
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { pool, getConnection, query, execute, init };
