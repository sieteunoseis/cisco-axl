"use strict";

/**
 * Connection utility for the cisco-axl CLI.
 * Resolves connection config from multiple sources with precedence:
 *   CLI flags > environment variables > config file (active cluster)
 * Creates an axlService instance for use by CLI commands.
 */

const { getActiveCluster, hasSsPlaceholders, resolveSsPlaceholders } = require("./config.js");

// ── resolveConfig ─────────────────────────────────────────────────────────────

/**
 * Resolves connection configuration from CLI flags, environment variables,
 * and the config file, in that order of precedence.
 *
 * Supported env vars: CUCM_HOST, CUCM_HOSTNAME, CUCM_USERNAME, CUCM_PASSWORD, CUCM_VERSION
 * The --cluster flag selects a specific named cluster from the config file.
 * The --version-cucm Commander flag is mapped to flags.versionCucm.
 *
 * @param {Object} flags - Parsed CLI flags (from Commander or similar).
 * @param {string} [flags.host]        - CUCM host override.
 * @param {string} [flags.username]    - CUCM username override.
 * @param {string} [flags.password]    - CUCM password override.
 * @param {string} [flags.versionCucm] - CUCM version override (Commander maps --version-cucm here).
 * @param {string} [flags.cluster]     - Named cluster to use from the config file.
 * @param {boolean} [flags.insecure]   - Disable TLS verification.
 * @param {boolean} [flags.debug]      - Enable debug logging.
 * @returns {Promise<{ host: string, username: string, password: string, version: string, insecure?: boolean }>}
 */
async function resolveConfig(flags = {}) {
  // ── Layer 1: config file (lowest priority) ──────────────────────────────────
  let cfgHost, cfgUsername, cfgPassword, cfgVersion, cfgInsecure;

  const clusterName = flags.cluster || undefined;
  const cluster = getActiveCluster(clusterName);

  if (clusterName && !cluster) {
    throw new Error(`Cluster "${clusterName}" not found`);
  }

  if (cluster) {
    cfgHost = cluster.host;
    cfgUsername = cluster.username;
    cfgPassword = cluster.password;
    cfgVersion = cluster.version;
    cfgInsecure = cluster.insecure;
  }

  // ── Layer 2: environment variables ─────────────────────────────────────────
  // CUCM_HOST takes precedence over CUCM_HOSTNAME
  const envHost = process.env.CUCM_HOST || process.env.CUCM_HOSTNAME;
  const envUsername = process.env.CUCM_USERNAME;
  const envPassword = process.env.CUCM_PASSWORD;
  const envVersion = process.env.CUCM_VERSION;

  // ── Layer 3: CLI flags (highest priority) ───────────────────────────────────
  const flagHost = flags.host;
  const flagUsername = flags.username;
  const flagPassword = flags.password;
  const flagVersion = flags.versionCucm;
  const flagInsecure = flags.insecure;

  // ── Merge: flags > env > config ─────────────────────────────────────────────
  const host = flagHost || envHost || cfgHost;
  const username = flagUsername || envUsername || cfgUsername;
  const password = flagPassword || envPassword || cfgPassword;
  const version = flagVersion || envVersion || cfgVersion;

  // insecure: flag overrides config; env has no insecure equivalent
  const insecure = flagInsecure !== undefined ? flagInsecure : cfgInsecure;

  // ── Validate required fields ─────────────────────────────────────────────────
  if (!host) {
    throw new Error(
      "No CUCM host configured. Provide --host, set CUCM_HOST, or add a cluster with: cisco-axl cluster add"
    );
  }
  if (!username) {
    throw new Error(
      "No CUCM username configured. Provide --username, set CUCM_USERNAME, or add a cluster with: cisco-axl cluster add"
    );
  }
  if (!password) {
    throw new Error(
      "No CUCM password configured. Provide --password, set CUCM_PASSWORD, or add a cluster with: cisco-axl cluster add"
    );
  }
  if (!version) {
    throw new Error(
      "No CUCM version configured. Provide --version-cucm, set CUCM_VERSION, or add a cluster with: cisco-axl cluster add"
    );
  }

  // ── Build result object ──────────────────────────────────────────────────────
  const result = { host, username, password, version };
  if (insecure !== undefined) {
    result.insecure = insecure;
  }

  // ── Resolve Secret Server placeholders if present ───────────────────────────
  if (hasSsPlaceholders(result)) {
    return resolveSsPlaceholders(result);
  }

  return result;
}

// ── createService ─────────────────────────────────────────────────────────────

/**
 * Resolves connection config, applies insecure/debug settings, and creates
 * an axlService instance.
 *
 * @param {Object} flags - Parsed CLI flags.
 * @returns {Promise<InstanceType<import('../../dist/index.js')>>}
 */
async function createService(flags = {}) {
  const config = await resolveConfig(flags);

  // Handle --insecure flag — suppress Node's TLS warning since user opted in
  if (config.insecure || flags.insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    process.emitWarning = ((orig) => function (warning, ...args) {
      if (typeof warning === "string" && warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")) return;
      return orig.call(process, warning, ...args);
    })(process.emitWarning);
  }

  // Build axlService options
  const opts = {};
  if (flags.debug) {
    opts.logging = { level: "debug" };
  }

  const axlService = require("../../dist/index.js");
  return new axlService(config.host, config.username, config.password, config.version, opts);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  resolveConfig,
  createService,
};
