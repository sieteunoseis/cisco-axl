"use strict";

/**
 * add command for the cisco-axl CLI.
 * Adds a new AXL item of the given type.
 * Supports --data (single), --template + --vars (single template), and
 * --template + --csv (bulk) modes.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");
const { readStdin } = require("../utils/stdin.js");

/**
 * Registers the add command on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerAddCommand(program) {
  program
    .command("add <type>")
    .description("Add a new AXL item of the given type")
    .option("--data <json>", "JSON definition of the item to add")
    .option("--stdin", "read JSON data from stdin (for piping)")
    .option("--template <file>", "JSON template file with %%var%% placeholders")
    .option("--vars <json>", "variables to resolve in template (JSON)")
    .option("--csv <file>", "CSV file for bulk operations (use with --template)")
    .option("--concurrency <n>", "max concurrent operations for bulk", "5")
    .option("--dry-run", "show resolved JSON without executing")
    .action(async (type, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "add");

        // Read from stdin if --stdin flag is set
        if (cmdOpts.stdin) {
          const stdinData = await readStdin();
          if (!stdinData) throw new Error("--stdin specified but no data piped. Pipe JSON via: echo '{...}' | cisco-axl add <type> --stdin");
          cmdOpts.data = stdinData.trim();
        }

        // Validate mutual exclusivity
        const inputCount = [cmdOpts.data, cmdOpts.template].filter(Boolean).length;
        if (inputCount > 1) {
          throw new Error("--data, --stdin, and --template are mutually exclusive");
        }
        if (inputCount === 0) {
          throw new Error("Provide input via --data, --stdin, or --template");
        }

        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        // ── Mode 1: --data (single, existing behaviour) ──────────────────────
        if (cmdOpts.data) {
          let data;
          try {
            data = JSON.parse(cmdOpts.data);
          } catch (parseErr) {
            throw new Error(`Invalid JSON provided for --data: ${parseErr.message}`);
          }

          const service = await createService(globalOpts);
          const result = await service.addItem(type, data, opts);
          await printResult(result, globalOpts.format);
          return;
        }

        // ── Template modes ────────────────────────────────────────────────────
        const fs = require("node:fs");
        const { resolveTemplate, parseCsvFile } = require("../utils/template.js");

        let templateData;
        try {
          templateData = JSON.parse(fs.readFileSync(cmdOpts.template, "utf-8"));
        } catch (err) {
          throw new Error(`Failed to read template file: ${err.message}`);
        }

        const itemKey = type.charAt(0).toLowerCase() + type.slice(1);

        // ── Mode 2: --template + --vars (single template) ────────────────────
        if (!cmdOpts.csv) {
          let vars = {};
          if (cmdOpts.vars) {
            try {
              vars = JSON.parse(cmdOpts.vars);
            } catch (parseErr) {
              throw new Error(`Invalid JSON provided for --vars: ${parseErr.message}`);
            }
          }

          const resolved = resolveTemplate(templateData, vars);

          if (cmdOpts.dryRun) {
            await printResult(resolved, globalOpts.format);
            return;
          }

          const service = await createService(globalOpts);
          const result = await service.addItem(type, resolved, opts);
          await printResult(result, globalOpts.format);
          return;
        }

        // ── Mode 3: --template + --csv (bulk) ────────────────────────────────
        let rows;
        try {
          rows = parseCsvFile(cmdOpts.csv);
        } catch (err) {
          throw new Error(`Failed to read CSV file: ${err.message}`);
        }

        if (cmdOpts.dryRun) {
          const dryResults = rows.map((row, i) => ({
            row: i + 1,
            resolved: resolveTemplate(templateData, row),
          }));
          await printResult(dryResults, globalOpts.format);
          return;
        }

        const concurrency = parseInt(cmdOpts.concurrency, 10) || 5;
        const operations = rows.map((row) => {
          const resolved = resolveTemplate(templateData, row);
          return { operation: `add${type}`, tags: { [itemKey]: resolved }, opts };
        });

        const service = await createService(globalOpts);
        const results = await service.executeBatch(operations, concurrency);

        const summary = results.map((r, i) => ({
          row: i + 1,
          status: r.success ? "OK" : "FAIL",
          result: r.success ? (r.result || "Success") : r.error.message,
        }));
        await printResult(summary, globalOpts.format);

        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.length - successCount;

        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveCluster } = require("../utils/config.js");
          const clusterName = getActiveCluster(globalOpts.cluster)?.name || "env/flags";
          logAudit({
            cluster: clusterName,
            operation: "add-bulk",
            type,
            duration_ms: Date.now() - startTime,
            status: failureCount > 0 ? "partial" : "success",
            totalCount: results.length,
            successCount,
            failureCount,
          });
        }
        return;
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false && !cmdOpts.csv) {
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
