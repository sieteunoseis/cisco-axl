"use strict";

/**
 * update command for the cisco-axl CLI.
 * Updates an existing AXL item by type and identifier.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

/**
 * Registers the update command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerUpdateCommand(program) {
  program
    .command("update <type> <identifier>")
    .description("Update an existing AXL item by type and name or UUID")
    .requiredOption("--data <json>", "JSON object of fields to update")
    .action(async (type, identifier, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        let updates;
        try {
          updates = JSON.parse(cmdOpts.data);
        } catch (parseErr) {
          throw new Error(`Invalid JSON provided for --data: ${parseErr.message}`);
        }

        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        const result = await service.updateItem(type, identifier, updates, opts);

        const format = globalOpts.format;
        await printResult(result, format);
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
            operation: "update",
            type,
            identifier,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
