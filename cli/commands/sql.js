"use strict";

/**
 * sql command for the cisco-axl CLI.
 * Executes SQL queries and updates against the CUCM database.
 */

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");

/**
 * Registers the sql command (with query and update subcommands) on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerSqlCommand(program) {
  const sql = program.command("sql").description("Execute SQL queries or updates against CUCM");

  sql
    .command("query <sql>")
    .description("Execute a SQL SELECT query")
    .action(async (sqlStr) => {
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

        const rawResult = await service.executeSqlQuery(sqlStr, opts);
        // Unwrap { row: [...] } wrapper from SQL results
        let result = rawResult;
        if (result && typeof result === "object" && !Array.isArray(result)) {
          const keys = Object.keys(result);
          if (keys.length === 1 && Array.isArray(result[keys[0]])) {
            result = result[keys[0]];
          }
        }
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
            operation: "executeSQLQuery",
            sql: sqlStr,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });

  sql
    .command("update <sql>")
    .description("Execute a SQL INSERT, UPDATE, or DELETE statement")
    .action(async (sqlStr) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "sql update");

        const service = await createService(globalOpts);
        const opts = {
          clean: globalOpts.clean || false,
          removeAttributes: !globalOpts.attributes,
        };

        const result = await service.executeSqlUpdate(sqlStr, opts);
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
            operation: "executeSQLUpdate",
            sql: sqlStr,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
