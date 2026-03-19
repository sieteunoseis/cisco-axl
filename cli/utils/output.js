"use strict";

const { formatJson } = require("../formatters/json.js");
const { formatCsv } = require("../formatters/csv.js");
const { formatTable } = require("../formatters/table.js");
const { formatToon } = require("../formatters/toon.js");

/**
 * Select the right formatter and print data to stdout.
 * @param {object|Array} data
 * @param {"table"|"json"|"toon"|"csv"} [format="table"]
 */
async function printResult(data, format = "table") {
  let output;

  switch (format) {
    case "json":
      output = formatJson(data);
      break;
    case "csv":
      output = formatCsv(data);
      break;
    case "toon":
      output = await formatToon(data);
      break;
    case "table":
    default:
      output = formatTable(data);
      break;
  }

  process.stdout.write(output + "\n");
}

/**
 * Print an error to stderr with actionable hints and set exit code to 1.
 * @param {Error|string} err
 */
function printError(err) {
  const message = err instanceof Error ? err.message : String(err);

  process.stderr.write(`Error: ${message}\n`);

  if (message.includes("Authentication failed")) {
    process.stderr.write(`Hint: Run "cisco-axl config test" to verify your credentials.\n`);
  } else if (message.includes("not found") && message.includes("Operation")) {
    process.stderr.write(`Hint: Run "cisco-axl operations" to see available operations.\n`);
  }

  process.exitCode = 1;
}

module.exports = { printResult, printError };
