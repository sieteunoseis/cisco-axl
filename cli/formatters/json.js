"use strict";

/**
 * Format data as pretty-printed JSON.
 * @param {object|Array} data
 * @returns {string}
 */
function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

module.exports = { formatJson };
