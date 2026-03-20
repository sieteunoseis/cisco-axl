"use strict";

/**
 * remove command for the cisco-axl CLI.
 * Removes an AXL item by type and identifier.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");

/**
 * Registers the remove command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerRemoveCommand(program) {
  program
    .command("remove <type> <identifier>")
    .description("Remove an AXL item by type and name or UUID")
    .action(async (type, identifier) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "remove");

        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        const result = await service.removeItem(type, identifier, opts);

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
            operation: "remove",
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
