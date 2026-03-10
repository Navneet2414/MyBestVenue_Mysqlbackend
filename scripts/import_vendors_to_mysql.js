/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { ensureVenuesTable } = require('../models/table_venues');

const parseArgs = (argv) => {
  const args = {
    file: path.resolve(__dirname, '../Data/wedding_platform.vendorsList100326.json'),
    dryRun: false,
    limit: null,
    mode: 'skip', // skip | upsert | replace
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--file') args.file = path.resolve(process.cwd(), argv[i + 1] || '');
    else if (token.startsWith('--file=')) args.file = path.resolve(process.cwd(), token.split('=').slice(1).join('='));
    else if (token === '--limit') args.limit = Number(argv[i + 1]);
    else if (token.startsWith('--limit=')) args.limit = Number(token.split('=').slice(1).join('='));
    else if (token === '--mode') args.mode = String(argv[i + 1] || '').trim().toLowerCase();
    else if (token.startsWith('--mode=')) args.mode = String(token.split('=').slice(1).join('=')).trim().toLowerCase();
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = null;
  if (!['skip', 'upsert', 'replace'].includes(args.mode)) args.mode = 'skip';
  return args;
};

const toTinyInt = (value) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  return 0;
};

const normalizeEmail = (email) => {
  const v = String(email || '').trim().toLowerCase();
  return v ? v : null;
};

const normalizePhone = (phone) => {
  const v = String(phone || '').trim();
  if (!v) return null;
  return v.replace(/[\s-]/g, '');
};

const parseMongoDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$date) return value.$date;
  return null;
};

// ISO 3166-2:IN (common vendor state codes) -> state name
const IN_STATE_CODE_TO_NAME = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CG: 'Chhattisgarh',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DD: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JK: 'Jammu and Kashmir',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  MN: 'Manipur',
  ML: 'Meghalaya',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OR: 'Odisha',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  UA: 'Uttarakhand',
  WB: 'West Bengal',
};

const normalizeCountryName = (country) => {
  const v = String(country || '').trim();
  if (!v) return null;
  if (v.toUpperCase() === 'IN') return 'India';
  return v;
};

const normalizeStateName = (state) => {
  const v = String(state || '').trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  if (IN_STATE_CODE_TO_NAME[upper]) return IN_STATE_CODE_TO_NAME[upper];
  return v;
};

const normalizeCityName = (city) => {
  const v = String(city || '').trim();
  return v ? v : null;
};

const ensureLocationTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tbl_country (
      country_id INT(11) NOT NULL AUTO_INCREMENT,
      country_name VARCHAR(100) NOT NULL,
      active TINYINT(1) DEFAULT 0,
      PRIMARY KEY (country_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tbl_state (
      state_id INT(11) NOT NULL AUTO_INCREMENT,
      state_name VARCHAR(100) NOT NULL,
      country_id INT(11) NOT NULL DEFAULT 1,
      active TINYINT(1) DEFAULT 0,
      PRIMARY KEY (state_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tbl_city (
      city_id INT(11) NOT NULL AUTO_INCREMENT,
      city_name VARCHAR(100) NOT NULL,
      state_id INT(11) NOT NULL,
      country_id INT(11) NOT NULL DEFAULT 1,
      active TINYINT(1) DEFAULT 0,
      PRIMARY KEY (city_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const main = async () => {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.file)) {
    console.error(`Input file not found: ${args.file}`);
    process.exit(1);
  }

  await db.init();
  await ensureVenuesTable(db.pool);
  await ensureLocationTables();

  const raw = fs.readFileSync(args.file, 'utf8');
  const vendors = JSON.parse(raw);
  const items = args.limit ? vendors.slice(0, args.limit) : vendors;

  const [existingRows] = await db.query('SELECT venue_id, email, phone FROM tbl_venue');
  const emailToId = new Map();
  const phoneToId = new Map();
  for (const r of existingRows) {
    const id = Number(r.venue_id);
    const e = normalizeEmail(r.email);
    const p = normalizePhone(r.phone);
    if (Number.isFinite(id) && id > 0) {
      if (e && !emailToId.has(e)) emailToId.set(e, id);
      if (p && !phoneToId.has(p)) phoneToId.set(p, id);
    }
  }

  const countryCache = new Map(); // country_name -> id
  const stateCache = new Map(); // `${countryId}|${state_name}` -> id
  const cityCache = new Map(); // `${countryId}|${stateId}|${city_name}` -> id

  const getOrCreateCountryId = async (countryValue) => {
    const countryName = normalizeCountryName(countryValue) || 'India';
    const key = countryName.toLowerCase();
    if (countryCache.has(key)) return countryCache.get(key);

    const [rows] = await db.query(
      'SELECT country_id FROM tbl_country WHERE LOWER(country_name) = LOWER(?) LIMIT 1',
      [countryName]
    );
    if (rows.length > 0) {
      countryCache.set(key, rows[0].country_id);
      return rows[0].country_id;
    }

    const [result] = await db.query('INSERT INTO tbl_country (country_name, active) VALUES (?, ?)', [
      countryName,
      0,
    ]);
    countryCache.set(key, result.insertId);
    return result.insertId;
  };

  const getOrCreateStateId = async (stateValue, countryId) => {
    const stateName = normalizeStateName(stateValue);
    if (!stateName) return null;

    const key = `${countryId}|${stateName.toLowerCase()}`;
    if (stateCache.has(key)) return stateCache.get(key);

    const [rows] = await db.query(
      'SELECT state_id FROM tbl_state WHERE country_id = ? AND LOWER(state_name) = LOWER(?) LIMIT 1',
      [countryId, stateName]
    );
    if (rows.length > 0) {
      stateCache.set(key, rows[0].state_id);
      return rows[0].state_id;
    }

    const [result] = await db.query(
      'INSERT INTO tbl_state (state_name, country_id, active) VALUES (?, ?, ?)',
      [stateName, countryId, 0]
    );
    stateCache.set(key, result.insertId);
    return result.insertId;
  };

  const getOrCreateCityId = async (cityValue, stateId, countryId) => {
    const cityName = normalizeCityName(cityValue);
    if (!cityName || !stateId) return null;

    const key = `${countryId}|${stateId}|${cityName.toLowerCase()}`;
    if (cityCache.has(key)) return cityCache.get(key);

    const [rows] = await db.query(
      'SELECT city_id FROM tbl_city WHERE country_id = ? AND state_id = ? AND LOWER(city_name) = LOWER(?) LIMIT 1',
      [countryId, stateId, cityName]
    );
    if (rows.length > 0) {
      cityCache.set(key, rows[0].city_id);
      return rows[0].city_id;
    }

    const [result] = await db.query(
      'INSERT INTO tbl_city (city_name, state_id, country_id, active) VALUES (?, ?, ?, ?)',
      [cityName, stateId, countryId, 0]
    );
    cityCache.set(key, result.insertId);
    return result.insertId;
  };

  let inserted = 0;
  let skipped = 0;
  let updated = 0;
  let invalid = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i += 1) {
    const v = items[i] || {};

    const email = normalizeEmail(v.email);
    const phone = normalizePhone(v.phone);
    if (!v.businessName || (!email && !phone)) {
      invalid += 1;
      continue;
    }

    const existingId = (email && emailToId.get(email)) || (phone && phoneToId.get(phone)) || null;
    if (args.mode === 'skip' && existingId) {
      skipped += 1;
      continue;
    }

    try {
      const countryId = await getOrCreateCountryId(v.country);
      const stateId = await getOrCreateStateId(v.state, countryId);
      const cityId = await getOrCreateCityId(v.city, stateId, countryId);

      const status =
        typeof v.status === 'string'
          ? (v.status || '').toLowerCase().includes('active')
            ? 1
            : 0
          : toTinyInt(v.status);

      const createdAt = parseMongoDate(v.createdAt);
      const updatedAt = parseMongoDate(v.updatedAt);

      const record = {
        businessName: String(v.businessName || '').trim(),
        businessType: String(v.businessType || 'venue').trim().toLowerCase(),
        contactName: v.contactName ? String(v.contactName).trim() : null,
        email,
        phone,
        password: v.password ? String(v.password) : null,
        profilePicture: v.profilePicture ? String(v.profilePicture) : null,
        status,
        address: v.address ? String(v.address) : null,
        city_id: cityId,
        state_id: stateId,
        country_id: countryId,
        pinCode: v.pinCode ? String(v.pinCode) : null,
        nearLocation: v.nearLocation ? String(v.nearLocation) : null,
        isApproved: toTinyInt(v.isApproved),
        isVerified: toTinyInt(v.isVerified),
        isPremium: toTinyInt(v.isPremium),
        isTrusted: toTinyInt(v.isTrusted),
        description: v.description ? String(v.description) : null,
        views: Number.isFinite(Number(v.views)) ? Number(v.views) : 0,
        businessExperience: Number.isFinite(Number(v.businessExperience)) ? Number(v.businessExperience) : null,
        venueCapacity: Number.isFinite(Number(v.venueCapacity)) ? Number(v.venueCapacity) : null,
        accountManager: v.accountManager ? String(v.accountManager) : null,
        advancePaymentRequired: toTinyInt(v.advancePaymentRequired),
        alcoholServed: toTinyInt(v.alcoholServed),
        barServiceAvailable: toTinyInt(v.barServiceAvailable),
        bookingEngineURL: v.bookingEngineURL ? String(v.bookingEngineURL) : null,
        danceFloor: toTinyInt(v.danceFloor),
        liveMusicAllowed: toTinyInt(v.liveMusicAllowed),
        musicSystem: toTinyInt(v.musicSystem),
        outsideLiquorPermitted: toTinyInt(v.outsideLiquorPermitted),
        parking: toTinyInt(v.parking),
        leadCommitment: Number.isFinite(Number(v.leadCommitment)) ? Number(v.leadCommitment) : null,
        metaTitle: v.metaTitle ? String(v.metaTitle) : null,
        metaKeywords: v.metaKeywords ? String(v.metaKeywords) : null,
        metaDescription: v.metaDescription ? String(v.metaDescription) : null,
        venue_website_url: v.websiteURL ? String(v.websiteURL) : null,
        updatedAt,
      };

      if (args.dryRun) {
        if (existingId && args.mode !== 'skip') updated += 1;
        else inserted += 1;
      } else {
        if (existingId && args.mode === 'replace') {
          // This can break foreign key style relationships. Prefer --mode upsert unless you know what you're doing.
          if (email && phone) await db.query('DELETE FROM tbl_venue WHERE email = ? OR phone = ?', [email, phone]);
          else if (email) await db.query('DELETE FROM tbl_venue WHERE email = ?', [email]);
          else if (phone) await db.query('DELETE FROM tbl_venue WHERE phone = ?', [phone]);
        }

        if (existingId && args.mode === 'upsert') {
          // Keep `venue_id` stable to avoid breaking relations. Do not touch OTP/reset-password fields.
          const setColumns = Object.keys(record).filter((k) => record[k] !== undefined);
          const setSql = setColumns.map((c) => `\`${c}\` = ?`).join(', ');
          const values = setColumns.map((k) => record[k]);
          await db.query(`UPDATE tbl_venue SET ${setSql} WHERE venue_id = ?`, [...values, existingId]);
          updated += 1;
        } else {
          const insertRecord = { ...record };
          // Only set createdAt on new insert (or replace insert), don't override existing history.
          insertRecord.createdAt = createdAt;
          const columns = Object.keys(insertRecord).filter((k) => insertRecord[k] !== undefined);
          const placeholders = columns.map(() => '?').join(', ');
          const values = columns.map((k) => insertRecord[k]);
          const sql = `INSERT INTO tbl_venue (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
          const [result] = await db.query(sql, values);
          inserted += 1;

          const newId = Number(result.insertId);
          if (email && Number.isFinite(newId) && newId > 0) emailToId.set(email, newId);
          if (phone && Number.isFinite(newId) && newId > 0) phoneToId.set(phone, newId);
        }
      }
    } catch (e) {
      errors += 1;
      console.error(`Row ${i + 1} failed:`, e.message || e);
    }
  }

  console.log(
    JSON.stringify(
      {
        file: args.file,
        dryRun: args.dryRun,
        mode: args.mode,
        totalInFile: vendors.length,
        processed: items.length,
        inserted,
        updated,
        skippedExisting: skipped,
        invalid,
        errors,
      },
      null,
      2
    )
  );

  await db.pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
