'use strict';

const fs = require('fs');
const path = require('path');

const { ensureSpacetypeTable } = require('./table_spacetype');
const { ensureVenueParkingTable } = require('./tbl_venueParking');
const { ensureVenueIndexes } = require('./ensure_venue_indexes');

const stripAndSplitSql = (sqlText) => {
  const sql = String(sqlText || '').replace(/^\uFEFF/, '');

  const statements = [];
  let current = '';

  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBlockComment = false;
  let inLineComment = false;

  const push = () => {
    const stmt = current.trim();
    if (stmt) statements.push(stmt);
    current = '';
  };

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        current += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    // Start comments (only when not in quotes).
    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '#' ) {
        inLineComment = true;
        continue;
      }
      if (ch === '-' && next === '-' && (sql[i + 2] === ' ' || sql[i + 2] === '\t' || sql[i + 2] === '\r' || sql[i + 2] === '\n')) {
        inLineComment = true;
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }
    }

    // Quote toggles.
    if (!inDouble && !inBacktick && ch === "'" && !inSingle) {
      inSingle = true;
      current += ch;
      continue;
    }
    if (inSingle && ch === "'") {
      // Handle escaped '' inside strings (SQL standard).
      if (next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingle = false;
      current += ch;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"' && !inDouble) {
      inDouble = true;
      current += ch;
      continue;
    }
    if (inDouble && ch === '"') {
      if (next === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inDouble = false;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ';') {
      push();
      continue;
    }

    current += ch;
  }

  push();
  return statements;
};

const applySqlFile = async (connectionOrPool, filePath) => {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, 'utf8');
  const statements = stripAndSplitSql(raw);

  const conn = typeof connectionOrPool?.getConnection === 'function' ? await connectionOrPool.getConnection() : null;
  const executor = conn || connectionOrPool;

  try {
    for (const stmt of statements) {
      const normalized = stmt.trim().replace(/\s+/g, ' ').toUpperCase();
      // Avoid switching/creating DB at runtime; app DB comes from .env (DB_NAME).
      if (normalized.startsWith('CREATE DATABASE ')) continue;
      if (normalized.startsWith('USE ')) continue;

      try {
        await executor.query(stmt);
      } catch (err) {
        // Allow running against pre-existing schemas that were created without IF NOT EXISTS.
        const isCreateTable = /^\s*CREATE\s+TABLE\b/i.test(stmt);
        const isAlreadyExists = err?.code === 'ER_TABLE_EXISTS_ERROR' || err?.errno === 1050;
        if (isCreateTable && isAlreadyExists) continue;

        // Some tables have FKs to `tbl_venue.venue_id`. If the existing DB has a different
        // `venue_id` COLUMN_TYPE than the schema file, MySQL/MariaDB throws 3780.
        // We handle these tables via dedicated "ensure_*" scripts that match the FK type.
        const msg = String(err?.message || '');
        const isFkTypeMismatch = err?.code === 'ER_FK_INCOMPATIBLE_COLUMNS' || err?.errno === 3780;
        const isKnownFkTable =
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`tbl_venue_images`/i.test(stmt) ||
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`tbl_venue_videos`/i.test(stmt) ||
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`tbl_venue_gst_details`/i.test(stmt) ||
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`table_venue_contacts`/i.test(stmt) ||
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`tbl_venue_contacts`/i.test(stmt);

        if (isFkTypeMismatch && isKnownFkTable) {
          // eslint-disable-next-line no-console
          console.warn(`ensureSchema: skipped FK-table DDL (will be ensured separately): ${msg}`);
          continue;
        }

        throw err;
      }
    }
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Initialize / migrate required DB tables for the app.
 * Keep this centralized so `server.js` stays clean.
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureSchema(connectionOrPool) {
  // Primary source of truth: `models/mybest_venuedb.sql` (idempotent CREATE TABLE IF NOT EXISTS).
  await applySqlFile(connectionOrPool, path.resolve(__dirname, './mybest_venuedb.sql'));

  // FK-sensitive tables (must match the *existing* `tbl_venue.venue_id` type).
  await applySqlFile(connectionOrPool, path.resolve(__dirname, '../scripts/ensure_table_venue_contacts.sql'));
  await applySqlFile(connectionOrPool, path.resolve(__dirname, '../scripts/ensure_tbl_venue_media.sql'));
  await applySqlFile(connectionOrPool, path.resolve(__dirname, '../scripts/ensure_tbl_venue_gst_details.sql'));

  // Some older DBs have too-small `name` columns; widen them so migration inserts won't fail.
  const ensureVarcharMinLen = async (tableName, columnName, minLen) => {
    try {
      const [rows] = await connectionOrPool.query(
        `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
      );
      if (!rows || rows.length === 0) return;

      const dataType = String(rows[0].DATA_TYPE || '').toLowerCase();
      const currentLen = Number(rows[0].CHARACTER_MAXIMUM_LENGTH);
      if (dataType !== 'varchar' || !Number.isFinite(currentLen) || currentLen >= minLen) return;

      const nullable = String(rows[0].IS_NULLABLE || '').toUpperCase() === 'YES' ? 'NULL' : 'NOT NULL';
      await connectionOrPool.query(
        `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` VARCHAR(${minLen}) ${nullable}`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `ensureSchema: unable to widen ${tableName}.${columnName} to VARCHAR(${minLen}):`,
        err.message || err
      );
    }
  };

  await ensureVarcharMinLen('tbl_food_categories_types', 'name', 100);
  await ensureVarcharMinLen('tbl_rental_types', 'name', 150);
  await ensureVarcharMinLen('table_venue_transportation', 'mode', 50);
  await ensureVarcharMinLen('table_venue_transportation', 'name', 255);

  await ensureSpacetypeTable(connectionOrPool);
  await ensureVenueParkingTable(connectionOrPool);
  await ensureVenueIndexes(connectionOrPool);
}

module.exports = { ensureSchema };
