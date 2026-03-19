"use strict";

const Table = require("cli-table3");

/**
 * Safely convert a value to a display string.
 * Nested objects/arrays are JSON-stringified.
 * @param {*} val
 * @returns {string}
 */
function toDisplayString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/**
 * Format data as an ASCII table.
 * - Arrays: column headers from object keys, footer with result count.
 * - Single objects: key-value vertical layout.
 * - Empty arrays: returns "No results found".
 * @param {object|Array} data
 * @returns {string}
 */
function formatTable(data) {
  // Empty array
  if (Array.isArray(data) && data.length === 0) {
    return "No results found";
  }

  // Array of objects — horizontal table
  if (Array.isArray(data)) {
    const keys = Object.keys(data[0]);
    const table = new Table({ head: keys });

    for (const row of data) {
      table.push(keys.map((k) => toDisplayString(row[k])));
    }

    const count = data.length;
    const footer = new Table();
    footer.push([{ colSpan: keys.length, content: `${count} results found` }]);

    return table.toString() + "\n" + footer.toString();
  }

  // Single object — vertical key-value table
  const table = new Table();
  for (const [key, val] of Object.entries(data)) {
    table.push({ [key]: toDisplayString(val) });
  }
  return table.toString();
}

module.exports = { formatTable };
