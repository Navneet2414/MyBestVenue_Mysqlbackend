'use strict';

const { ensureSpacetypeTable } = require('./table_spacetype');
const { ensureVenuesTable, ensureTableVenueTable } = require('./table_venues');
const { ensureVenueParkingTable } = require('./tbl_venueParking');
const { ensureVenueIndexes } = require('./ensure_venue_indexes');

/**
 * Initialize / migrate required DB tables for the app.
 * Keep this centralized so `server.js` stays clean.
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').Connection} connectionOrPool
 */
async function ensureSchema(connectionOrPool) {
  // await ensureVenuesTable(connectionOrPool);
  // await ensureTableVenueTable(connectionOrPool);
  await ensureSpacetypeTable(connectionOrPool);
  await ensureVenueParkingTable(connectionOrPool);
  await ensureVenueIndexes(connectionOrPool);
}

module.exports = { ensureSchema };
