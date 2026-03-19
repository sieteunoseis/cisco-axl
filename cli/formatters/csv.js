"use strict";

const { stringify } = require("csv-stringify/sync");

/**
 * Format data as CSV with a header row.
 * Single objects are wrapped in an array automatically.
 * @param {object|Array} data
 * @returns {string}
 */
function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  return stringify(rows, { header: true });
}

module.exports = { formatCsv };
