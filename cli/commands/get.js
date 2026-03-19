"use strict";

/**
 * get command for the cisco-axl CLI.
 * Fetches a single AXL item by type and identifier.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

/**
 * Registers the get command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerGetCommand(program) {
  program
    .command("get <type> <identifier>")
    .description("Get a single AXL item by type and name or UUID")
    .option("--returned-tags <tags>", "comma-separated list of fields to return")
    .action(async (type, identifier, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        let result;

        if (cmdOpts.returnedTags) {
          // Use executeOperation to support returnedTags
          const operationName = "get" + type;
          const tags = await service.getOperationTags(operationName);

          // Set identifier in tags
          if (/^[0-9a-f]{8}-/i.test(identifier)) {
            tags.uuid = identifier;
          } else {
            tags.name = identifier;
          }

          // Build returnedTags object from comma-separated list
          const returnedTags = {};
          for (const field of cmdOpts.returnedTags.split(",")) {
            const trimmed = field.trim();
            if (trimmed) returnedTags[trimmed] = "";
          }
          tags.returnedTags = returnedTags;

          result = await service.executeOperation(operationName, tags, opts);
        } else {
          result = await service.getItem(type, identifier, opts);
        }

        // Unwrap single-key wrapper (e.g., { phone: {...} } → {...})
        let output = result;
        if (result && typeof result === "object" && !Array.isArray(result)) {
          const keys = Object.keys(result);
          if (keys.length === 1 && typeof result[keys[0]] === "object" && result[keys[0]] !== null) {
            output = result[keys[0]];
          }
        }

        const format = globalOpts.format;
        await printResult(output, format);
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
            operation: "get",
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
