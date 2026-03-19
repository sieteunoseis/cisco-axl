"use strict";

/**
 * Check if read-only mode is active (via --read-only flag or cluster config).
 * Throws an error if a write operation is attempted in read-only mode.
 *
 * @param {object} globalOpts - Commander global options
 * @param {string} operation - The operation being attempted (for error message)
 */
function enforceReadOnly(globalOpts, operation) {
  if (globalOpts.readOnly) {
    throw new Error(
      `Operation "${operation}" blocked — read-only mode is active.\n` +
      "Read-only mode only allows: get, list, describe, operations, sql query.\n" +
      "Remove --read-only flag to perform write operations."
    );
  }

  // Also check cluster config for readOnly setting
  const { getActiveCluster } = require("./config.js");
  const cluster = getActiveCluster(globalOpts.cluster);
  if (cluster && cluster.readOnly) {
    throw new Error(
      `Operation "${operation}" blocked — cluster "${cluster.name}" is configured as read-only.\n` +
      "Update the cluster config to allow write operations:\n" +
      `  cisco-axl config add ${cluster.name} ... (without read-only)`
    );
  }
}

module.exports = { enforceReadOnly };
