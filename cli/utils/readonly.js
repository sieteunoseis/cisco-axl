"use strict";

const { checkWriteAllowed } = require("./confirm.js");

/**
 * Check if read-only mode is active (via --read-only flag or cluster config).
 * If read-only, requires interactive TTY confirmation with a random word.
 * Non-interactive sessions (AI agents without TTY) fail automatically.
 *
 * @param {object} globalOpts - Commander global options
 * @param {string} operation - The operation being attempted (for error message)
 */
async function enforceReadOnly(globalOpts, operation) {
  const { getActiveCluster } = require("./config.js");
  const cluster = getActiveCluster(globalOpts.cluster);
  const clusterConfig = cluster || {};

  // Build a combined config for checkWriteAllowed
  const config = {
    readOnly: globalOpts.readOnly || clusterConfig.readOnly || false,
  };

  await checkWriteAllowed(config, globalOpts);
}

module.exports = { enforceReadOnly };
