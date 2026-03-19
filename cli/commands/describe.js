"use strict";

/**
 * describe command for the cisco-axl CLI.
 * Describes the tags/schema for a given AXL operation.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

/**
 * Flatten detailed tag metadata into a flat array of rows for table display.
 * Only processes top-level tags (does not recurse into children).
 * @param {Record<string, object>} detailed
 * @returns {Array<{tag: string, required: string, nillable: string, type: string, children: string}>}
 */
function flattenDetailed(detailed) {
  const rows = [];
  for (const [key, meta] of Object.entries(detailed)) {
    rows.push({
      tag: key,
      required: meta.required ? "yes" : "no",
      nillable: meta.nillable ? "yes" : "no",
      type: meta.type || "-",
      children: meta.children ? `${Object.keys(meta.children).length} fields` : "-",
    });
  }
  return rows;
}

/**
 * Registers the describe command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerDescribeCommand(program) {
  program
    .command("describe <operation>")
    .description("Describe the tags/schema for a given AXL operation")
    .option("--detailed", "show detailed tag metadata including required, nillable, type, children")
    .action(async (operation, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const format = globalOpts.format;

        if (cmdOpts.detailed) {
          const detailed = await service.getOperationTagsDetailed(operation);
          if (format === "table") {
            const rows = flattenDetailed(detailed);
            await printResult(rows, "table");
          } else {
            await printResult(detailed, format);
          }
        } else {
          const tags = await service.getOperationTags(operation);
          await printResult(tags, format);
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
            operation: "describe",
            axlOperation: operation,
            detailed: cmdOpts.detailed || false,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
