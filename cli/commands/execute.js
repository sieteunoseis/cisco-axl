"use strict";

/**
 * execute command for the cisco-axl CLI.
 * Executes a raw AXL operation with provided tags.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

/**
 * Registers the execute command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerExecuteCommand(program) {
  program
    .command("execute <operation>")
    .description("Execute a raw AXL operation with JSON tags")
    .requiredOption("--tags <json>", "JSON object of operation tags")
    .action(async (operation, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      let tags;
      try {
        tags = JSON.parse(cmdOpts.tags);
      } catch (parseErr) {
        printError(new Error(`Invalid JSON provided for --tags: ${parseErr.message}`));
        process.exitCode = 1;
        return;
      }

      try {
        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        const result = await service.executeOperation(operation, tags, opts);
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
            operation: "executeOperation",
            axlOperation: operation,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
