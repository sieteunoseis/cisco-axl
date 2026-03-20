"use strict";

/**
 * config subcommands for the cisco-axl CLI.
 * Manages multi-cluster configuration.
 */

const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");
const { createService } = require("../utils/connection.js");

/**
 * Registers config subcommands on the given Commander program.
 * @param {import("commander").Command} program
 */
module.exports = function registerConfigCommand(program) {
  const config = program
    .command("config")
    .description("Manage CUCM cluster configuration");

  // ── config add <name> ───────────────────────────────────────────────────────

  config
    .command("add <name>")
    .description("Add a named CUCM cluster to config (use --host, --username, --password, --version-cucm)")
    .option("--cucm-version <ver>", "CUCM version (e.g. 14.0)")
    .option("--insecure", "skip TLS verification for this cluster")
    .action((name, opts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const host = globalOpts.host;
        const username = globalOpts.username;
        const password = globalOpts.password;
        const version = opts.cucmVersion || globalOpts.versionCucm;
        if (!host) throw new Error("Missing required option: --host");
        if (!username) throw new Error("Missing required option: --username");
        if (!password) throw new Error("Missing required option: --password");
        if (!version) throw new Error("Missing required option: --cucm-version or --version-cucm");

        const clusterOpts = { host, username, password, version };
        if (opts.insecure || globalOpts.insecure) {
          clusterOpts.insecure = true;
        }

        configUtil.addCluster(name, clusterOpts);
        process.stdout.write(`Cluster "${name}" added successfully.\n`);
      } catch (err) {
        printError(err);
      }
    });

  // ── config use <name> ───────────────────────────────────────────────────────

  config
    .command("use <name>")
    .description("Set a named cluster as the active cluster")
    .action((name) => {
      try {
        configUtil.useCluster(name);
        process.stdout.write(`Cluster "${name}" is now the active cluster.\n`);
      } catch (err) {
        printError(err);
      }
    });

  // ── config list ─────────────────────────────────────────────────────────────

  config
    .command("list")
    .description("List all configured clusters")
    .action(async () => {
      try {
        const { activeCluster, clusters } = configUtil.listClusters();
        const rows = Object.entries(clusters).map(([name, cluster]) => ({
          name,
          active: name === activeCluster ? "\u2713" : "",
          host: cluster.host,
          username: cluster.username,
          version: cluster.version,
        }));
        const format = program.opts().format;
        await printResult(rows, format);
      } catch (err) {
        printError(err);
      }
    });

  // ── config show ─────────────────────────────────────────────────────────────

  config
    .command("show")
    .description("Show the active cluster configuration")
    .action(async () => {
      try {
        const clusterName = program.opts().cluster;
        const cluster = configUtil.getActiveCluster(clusterName);
        if (!cluster) {
          printError(new Error("No active cluster configured. Run: cisco-axl config add"));
          return;
        }
        const display = {
          ...cluster,
          password: configUtil.maskPassword(cluster.password),
        };
        const format = program.opts().format;
        await printResult(display, format);
      } catch (err) {
        printError(err);
      }
    });

  // ── config remove <name> ────────────────────────────────────────────────────

  config
    .command("remove <name>")
    .description("Remove a named cluster from config")
    .action((name) => {
      try {
        configUtil.removeCluster(name);
        process.stdout.write(`Cluster "${name}" removed successfully.\n`);
      } catch (err) {
        printError(err);
      }
    });

  // ── config test ─────────────────────────────────────────────────────────────

  config
    .command("test")
    .description("Test connectivity and authentication to the active cluster")
    .action(async () => {
      try {
        const flags = program.opts();
        const service = await createService(flags);
        const result = await service.testAuthentication();

        const clusterName = flags.cluster || configUtil.getActiveCluster()?.name || "unknown";
        const cluster = configUtil.getActiveCluster(flags.cluster);
        const host = cluster ? cluster.host : flags.host || "unknown";
        const ver = result.return?.ComponentVersion?.Version || cluster?.version || "unknown";

        process.stdout.write(
          `Connection to ${clusterName} (${host}) successful \u2014 CUCM version ${ver}\n`
        );
      } catch (err) {
        printError(err);
      }
    });
};
