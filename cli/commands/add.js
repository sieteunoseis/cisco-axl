"use strict";

/**
 * add command for the cisco-axl CLI.
 * Adds a new AXL item of the given type.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

/**
 * Registers the add command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerAddCommand(program) {
  program
    .command("add <type>")
    .description("Add a new AXL item of the given type")
    .requiredOption("--data <json>", "JSON definition of the item to add")
    .action(async (type, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        let data;
        try {
          data = JSON.parse(cmdOpts.data);
        } catch (parseErr) {
          throw new Error(`Invalid JSON provided for --data: ${parseErr.message}`);
        }

        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        const result = await service.addItem(type, data, opts);

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
            operation: "add",
            type,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
