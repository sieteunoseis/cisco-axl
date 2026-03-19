"use strict";

/**
 * Template utility for the cisco-axl CLI.
 * Supports %%var%% placeholder resolution via json-variables
 * and bulk CSV file parsing via csv-parse.
 *
 * Both packages are optional — a helpful error is thrown if not installed.
 */

const fs = require("node:fs");

const TEMPLATE_DEPS_MSG =
  "Template features require optional packages. Install with:\n  npm install json-variables csv-parse";

/**
 * Lazily require json-variables, throwing a helpful error if not installed.
 */
function requireJVar() {
  try {
    return require("json-variables");
  } catch {
    throw new Error(TEMPLATE_DEPS_MSG);
  }
}

/**
 * Lazily require csv-parse/sync, throwing a helpful error if not installed.
 */
function requireCsvParse() {
  try {
    return require("csv-parse/sync");
  } catch {
    throw new Error(TEMPLATE_DEPS_MSG);
  }
}

/**
 * Resolve %%var%% placeholders in a template using json-variables.
 * Static values pass through unchanged.
 *
 * @param {Object} template - Template object with %%var%% placeholders.
 * @param {Object} vars - Variables to substitute into the template.
 * @returns {Object} Resolved object with only template keys.
 */
function resolveTemplate(template, vars) {
  const jVar = requireJVar();
  // json-variables resolves %%key%% from sibling keys in the same object
  const input = { ...template, ...vars };
  const resolved = jVar(input, {
    heads: "%%",
    tails: "%%",
    lookForDataContainers: false,
    noSingleMarkers: true,
  });
  // Keep only template keys (remove the vars we merged in)
  const result = {};
  for (const key of Object.keys(template)) {
    result[key] = resolved[key];
  }
  return result;
}

/**
 * Parse a CSV file into an array of objects (column headers as keys).
 *
 * @param {string} filePath - Path to the CSV file.
 * @returns {Object[]} Array of row objects.
 */
function parseCsvFile(filePath) {
  const { parse } = requireCsvParse();
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

module.exports = { resolveTemplate, parseCsvFile, TEMPLATE_DEPS_MSG };
