"use strict";

/**
 * execute command for the cisco-axl CLI.
 * Executes a raw AXL operation with provided tags.
 * Supports --tags (single), --template + --vars (single template), and
 * --template + --csv (bulk) modes.
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
    .option("--tags <json>", "JSON object of operation tags")
    .option("--template <file>", "JSON template file with %%var%% placeholders")
    .option("--vars <json>", "variables to resolve in template (JSON)")
    .option("--csv <file>", "CSV file for bulk operations (use with --template)")
    .option("--concurrency <n>", "max concurrent operations for bulk", "5")
    .option("--dry-run", "show resolved JSON without executing")
    .action(async (operation, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        // Validate mutual exclusivity
        if (cmdOpts.tags && cmdOpts.template) {
          throw new Error("--tags and --template are mutually exclusive");
        }
        if (!cmdOpts.tags && !cmdOpts.template) {
          throw new Error("Either --tags or --template must be provided");
        }

        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        // ── Mode 1: --tags (single, existing behaviour) ──────────────────────
        if (cmdOpts.tags) {
          let tags;
          try {
            tags = JSON.parse(cmdOpts.tags);
          } catch (parseErr) {
            throw new Error(`Invalid JSON provided for --tags: ${parseErr.message}`);
          }

          const service = await createService(globalOpts);
          const result = await service.executeOperation(operation, tags, opts);
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
          const result = await service.executeOperation(operation, resolved, opts);
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
          return { operation, tags: resolved, opts };
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
            operation: "executeOperation-bulk",
            axlOperation: operation,
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
