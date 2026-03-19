"use strict";

/**
 * list command for the cisco-axl CLI.
 * Lists AXL items of a given type with optional search criteria and pagination.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

/**
 * Collect helper for repeatable Commander options.
 * @param {string} val
 * @param {string[]} previous
 * @returns {string[]}
 */
function collect(val, previous) {
  return previous.concat([val]);
}

/**
 * Parse "key=value" search criteria strings into a Record<string,string>.
 * @param {string[]} criteria
 * @returns {Record<string,string>}
 */
function parseCriteria(criteria) {
  const result = {};
  for (const item of criteria) {
    const eqIdx = item.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid search criteria "${item}". Expected format: key=value`);
    }
    const key = item.slice(0, eqIdx).trim();
    const value = item.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

/**
 * Parse a comma-separated tag list into a Record<string,string>.
 * @param {string} tags
 * @returns {Record<string,string>}
 */
function parseTags(tags) {
  const result = {};
  for (const field of tags.split(",")) {
    const trimmed = field.trim();
    if (trimmed) result[trimmed] = "";
  }
  return result;
}

/**
 * Count rows in a list result (handles array or object with array value).
 * @param {*} result
 * @returns {number}
 */
function countRows(result) {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object") {
    for (const val of Object.values(result)) {
      if (Array.isArray(val)) return val.length;
    }
  }
  return 0;
}

/**
 * Check if a list result has any rows.
 * @param {*} result
 * @returns {boolean}
 */
function hasRows(result) {
  return countRows(result) > 0;
}

/**
 * Unwrap list results from AXL's type wrapper.
 * AXL returns list results like { routePartition: [...] } or { row: [...] }.
 * This extracts the array for cleaner display.
 * @param {*} result
 * @returns {*}
 */
function unwrapListResult(result) {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const keys = Object.keys(result);
    if (keys.length === 1 && Array.isArray(result[keys[0]])) {
      return result[keys[0]];
    }
  }
  return result;
}

/**
 * Registers the list command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerListCommand(program) {
  program
    .command("list <type>")
    .description("List AXL items of a given type")
    .option("--search <criteria>", "search criteria as key=value (repeatable)", collect, [])
    .option("--returned-tags <tags>", "comma-separated list of fields to return")
    .option("--skip <n>", "skip first N results", parseInt)
    .option("--first <n>", "return first N results", parseInt)
    .option("--auto-page", "automatically paginate through all results")
    .option("--max-results <n>", "cap total results when using --auto-page", parseInt, 10000)
    .action(async (type, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;
      let totalRows = 0;

      try {
        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        const searchCriteria = cmdOpts.search.length > 0 ? parseCriteria(cmdOpts.search) : {};
        const returnedTags = cmdOpts.returnedTags ? parseTags(cmdOpts.returnedTags) : undefined;

        const needsExecuteOperation =
          cmdOpts.skip !== undefined || cmdOpts.first !== undefined;

        if (cmdOpts.autoPage) {
          // Auto-pagination mode
          const maxResults = cmdOpts.maxResults || 10000;
          const pageSize = cmdOpts.first || 1000;
          const allRows = [];
          let skip = cmdOpts.skip || 0;

          while (allRows.length < maxResults) {
            const tags = await service.getOperationTags("list" + type);
            if (Object.keys(searchCriteria).length > 0) {
              tags.searchCriteria = searchCriteria;
            }
            if (returnedTags) {
              tags.returnedTags = returnedTags;
            }
            tags.skip = String(skip);
            tags.first = String(Math.min(pageSize, maxResults - allRows.length));

            const pageResult = await service.executeOperation("list" + type, tags, opts);

            if (!hasRows(pageResult)) break;

            const rows = Array.isArray(pageResult)
              ? pageResult
              : Object.values(pageResult).find((v) => Array.isArray(v)) || [];

            allRows.push(...rows);
            skip += rows.length;

            if (rows.length < pageSize) break;
          }

          totalRows = allRows.length;
          const format = globalOpts.format;
          await printResult(allRows, format);
        } else if (needsExecuteOperation) {
          // Use executeOperation when skip or first are provided
          const tags = await service.getOperationTags("list" + type);
          if (Object.keys(searchCriteria).length > 0) {
            tags.searchCriteria = searchCriteria;
          }
          if (returnedTags) {
            tags.returnedTags = returnedTags;
          }
          if (cmdOpts.skip !== undefined) {
            tags.skip = String(cmdOpts.skip);
          }
          if (cmdOpts.first !== undefined) {
            tags.first = String(cmdOpts.first);
          }

          const rawResult = await service.executeOperation("list" + type, tags, opts);
          const result = unwrapListResult(rawResult);
          totalRows = countRows(result);
          const format = globalOpts.format;
          await printResult(result, format);
        } else {
          // Basic list
          const rawResult = await service.listItems(type, searchCriteria, returnedTags, opts);
          const result = unwrapListResult(rawResult);
          totalRows = countRows(result);
          const format = globalOpts.format;
          await printResult(result, format);
        }
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveCluster } = require("../utils/config.js");
          const clusterName = getActiveCluster(globalOpts.cluster)?.name || "env/flags";
          const entry = {
            cluster: clusterName,
            operation: "list",
            type,
            duration_ms: Date.now() - startTime,
            rows: totalRows,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
