"use strict";

const { loadConfig, getConfigPath, getConfigDir } = require("../utils/config.js");
const { resolveConfig } = require("../utils/connection.js");

module.exports = function (program) {
  program.command("doctor")
    .description("Check AXL connectivity and configuration health")
    .action(async (opts, command) => {
      const globalOpts = command.optsWithGlobals();
      let passed = 0;
      let warned = 0;
      let failed = 0;

      const ok = (msg) => { console.log(`  ✓ ${msg}`); passed++; };
      const warn = (msg) => { console.log(`  ⚠ ${msg}`); warned++; };
      const fail = (msg) => { console.log(`  ✗ ${msg}`); failed++; };

      console.log("\n  cisco-axl doctor");
      console.log("  " + "─".repeat(50));

      // 1. Configuration
      console.log("\n  Configuration");
      let conn;
      try {
        const data = loadConfig();
        if (!data.activeCluster) {
          fail("No active cluster configured");
          console.log("    Run: cisco-axl config add <name> --host <host> --username <user> --password <pass> --cucm-version <ver>");
          printSummary(passed, warned, failed);
          return;
        }
        ok(`Active cluster: ${data.activeCluster}`);
        const cluster = data.clusters[data.activeCluster];
        ok(`Host: ${cluster.host}`);
        ok(`Username: ${cluster.username}`);
        ok(`CUCM version: ${cluster.version}`);

        if (cluster.insecure) warn("TLS verification: disabled (--insecure)");
        else ok("TLS verification: enabled");

        conn = await resolveConfig(globalOpts);
      } catch (err) {
        fail(`Config error: ${err.message}`);
        printSummary(passed, warned, failed);
        return;
      }

      // 2. AXL API connectivity
      console.log("\n  AXL API");
      try {
        if (conn.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        const axlService = require("../../dist/index.js");
        const service = new axlService(conn.host, conn.username, conn.password, conn.version);

        await service.testAuthentication();
        ok(`AXL API: connected`);

        // Try a simple SQL query to verify read access
        try {
          const sqlResult = await service.executeSqlQuery("SELECT COUNT(*) AS cnt FROM device");
          const rows = Array.isArray(sqlResult) ? sqlResult : sqlResult?.row || [];
          const count = rows[0]?.cnt || "?";
          ok(`SQL query: ${count} device(s) in database`);
        } catch {
          warn("SQL query: could not query device table — may lack permissions");
        }

        // Check operation count
        try {
          const ops = await service.returnOperations();
          const count = Array.isArray(ops) ? ops.length : 0;
          ok(`AXL operations: ${count} available`);
        } catch {
          warn("Could not list AXL operations");
        }
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes("401") || msg.includes("Authentication") || msg.includes("Unauthorized")) {
          fail("AXL API: authentication failed — check username/password");
        } else if (msg.includes("ECONNREFUSED")) {
          fail("AXL API: connection refused — check host and port");
        } else if (msg.includes("ENOTFOUND")) {
          fail("AXL API: hostname not found — check host");
        } else if (msg.includes("certificate")) {
          fail("AXL API: TLS certificate error — try adding --insecure to the cluster config");
        } else {
          fail(`AXL API: ${msg}`);
        }
      }

      // 3. Security
      console.log("\n  Security");
      try {
        const fs = require("node:fs");
        const configPath = getConfigPath();
        const stats = fs.statSync(configPath);
        const mode = (stats.mode & 0o777).toString(8);
        if (mode === "600") ok(`Config file permissions: ${mode} (secure)`);
        else warn(`Config file permissions: ${mode} — should be 600. Run: chmod 600 ${configPath}`);
      } catch { /* config file may not exist yet */ }

      // 4. Audit trail
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const auditPath = path.join(getConfigDir(), "audit.jsonl");
        if (fs.existsSync(auditPath)) {
          const stats = fs.statSync(auditPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
          ok(`Audit trail: ${sizeMB}MB`);
          if (stats.size > 8 * 1024 * 1024) warn("Audit trail approaching 10MB rotation limit");
        } else {
          ok("Audit trail: empty (no operations logged yet)");
        }
      } catch { /* ignore */ }

      printSummary(passed, warned, failed);
    });

  function printSummary(passed, warned, failed) {
    console.log("\n  " + "─".repeat(50));
    console.log(`  Results: ${passed} passed, ${warned} warning${warned !== 1 ? "s" : ""}, ${failed} failed`);
    if (failed > 0) {
      process.exitCode = 1;
      console.log("  Status:  issues found — review failures above");
    } else if (warned > 0) {
      console.log("  Status:  healthy with warnings");
    } else {
      console.log("  Status:  all systems healthy");
    }
    console.log("");
  }
};
