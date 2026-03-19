"use strict";

const { Command } = require("commander");
const { version } = require("../package.json");

const program = new Command();

program
  .name("cisco-axl")
  .description("CLI for Cisco CUCM AXL operations")
  .version(version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "CUCM hostname (overrides config/env)")
  .option("--username <user>", "CUCM username (overrides config/env)")
  .option("--password <pass>", "CUCM password (overrides config/env)")
  .option("--version-cucm <ver>", "CUCM version (overrides config/env)")
  .option("--cluster <name>", "use a specific named cluster")
  .option("--clean", "remove empty/null values from results")
  .option("--no-attributes", "remove XML attributes from results")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--debug", "enable debug logging");

// Register commands
require("./commands/config.js")(program);
require("./commands/get.js")(program);
require("./commands/list.js")(program);
require("./commands/add.js")(program);
require("./commands/update.js")(program);
require("./commands/remove.js")(program);
// require("./commands/phone.js")(program);
// require("./commands/line.js")(program);
// require("./commands/user.js")(program);
// require("./commands/device-pool.js")(program);
// require("./commands/route-pattern.js")(program);

program.parse();
