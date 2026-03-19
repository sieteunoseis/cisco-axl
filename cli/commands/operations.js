"use strict";

/**
 * operations command for the cisco-axl CLI.
 * Lists available AXL operations, with optional filtering by text or type.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

const CRUD_PREFIXES = ["add", "get", "list", "update", "remove"];
const ACTION_PREFIXES = ["apply", "reset", "restart", "do", "lock", "wipe", "assign", "unassign"];

/**
 * Registers the operations command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerOperationsCommand(program) {
  program
    .command("operations")
    .description("List available AXL operations")
    .option("--filter <text>", "filter operations by text substring")
    .option("--type <kind>", "filter by type: crud or action")
    .action(async (cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);

        let operations = await service.returnOperations(cmdOpts.filter);

        if (cmdOpts.type) {
          const type = cmdOpts.type.toLowerCase();
          if (type === "crud") {
            operations = operations.filter((op) =>
              CRUD_PREFIXES.some((prefix) => op.startsWith(prefix))
            );
          } else if (type === "action") {
            operations = operations.filter((op) =>
              ACTION_PREFIXES.some((prefix) => op.startsWith(prefix))
            );
          }
        }

        const format = globalOpts.format;
        if (format === "json" || format === "toon") {
          await printResult(operations, format);
        } else if (format === "csv") {
          const wrapped = operations.map((op) => ({ operation: op }));
          await printResult(wrapped, "csv");
        } else {
          // Default table: one operation per line
          console.log(operations.join("\n"));
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
            operation: "returnOperations",
            filter: cmdOpts.filter,
            type: cmdOpts.type,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
