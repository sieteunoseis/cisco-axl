"use strict";

/**
 * Config utility for the cisco-axl CLI.
 * Manages multi-cluster configuration stored at ~/.cisco-axl/config.json.
 * Supports Secret Server (<ss:ID:field>) placeholder resolution via ss-cli.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

// ── Constants ─────────────────────────────────────────────────────────────────

/** Supported CUCM versions. */
const VALID_VERSIONS = ["11.0", "11.5", "12.0", "12.5", "14.0", "15.0"];

/** Regex matching a Secret Server placeholder: <ss:ID:field> */
const SS_PLACEHOLDER_RE = /<ss:\d+:[^>]+>/;

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the config directory path.
 * Respects the CISCO_AXL_CONFIG_DIR env var for test isolation.
 * @returns {string}
 */
function getConfigDir() {
  return process.env.CISCO_AXL_CONFIG_DIR || path.join(require("node:os").homedir(), ".cisco-axl");
}

/**
 * Returns the full path to the config file.
 * @returns {string}
 */
function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

// ── Core I/O ──────────────────────────────────────────────────────────────────

/**
 * Loads the config from disk.
 * Returns a default empty config if the file does not exist.
 * @returns {{ activeCluster: string|null, clusters: Object }}
 */
function loadConfig() {
  const cfgPath = getConfigPath();
  if (!fs.existsSync(cfgPath)) {
    return { activeCluster: null, clusters: {} };
  }
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load config from ${cfgPath}: ${err.message}`);
  }
}

/**
 * Writes the config to disk with 0600 permissions.
 * Creates the config directory if it does not exist.
 * @param {{ activeCluster: string|null, clusters: Object }} config
 */
function saveConfig(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cfgPath = getConfigPath();
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(cfgPath, json, { mode: 0o600, encoding: "utf8" });
}

// ── Cluster management ────────────────────────────────────────────────────────

/**
 * Adds a named cluster to the config.
 * The first cluster added automatically becomes the active cluster.
 * @param {string} name - Cluster name.
 * @param {{ host: string, username: string, password: string, version: string, insecure?: boolean }} opts
 */
function addCluster(name, opts) {
  const { host, username, password, version, insecure } = opts;

  if (!VALID_VERSIONS.includes(version)) {
    throw new Error(
      `Invalid version "${version}". Valid versions are: ${VALID_VERSIONS.join(", ")}`
    );
  }

  const config = loadConfig();

  const entry = { host, username, password, version };
  if (insecure !== undefined) {
    entry.insecure = insecure;
  }

  config.clusters[name] = entry;

  // First cluster becomes active automatically
  if (config.activeCluster === null || Object.keys(config.clusters).length === 1) {
    config.activeCluster = name;
  }

  saveConfig(config);
  return config;
}

/**
 * Switches the active cluster to the named cluster.
 * @param {string} name - Cluster name.
 */
function useCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) {
    throw new Error(`Cluster "${name}" not found`);
  }
  config.activeCluster = name;
  saveConfig(config);
  return config;
}

/**
 * Removes a named cluster from the config.
 * If the removed cluster was active, switches to the next available cluster (or null).
 * @param {string} name - Cluster name.
 */
function removeCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) {
    throw new Error(`Cluster "${name}" not found`);
  }

  const wasActive = config.activeCluster === name;
  delete config.clusters[name];

  if (wasActive) {
    const remaining = Object.keys(config.clusters);
    config.activeCluster = remaining.length > 0 ? remaining[0] : null;
  }

  saveConfig(config);
  return config;
}

/**
 * Returns the active cluster config (with a `name` field added).
 * If clusterName is provided, returns that specific cluster instead.
 * Returns null if no cluster is found.
 * @param {string} [clusterName] - Optional specific cluster name.
 * @returns {{ name: string, host: string, username: string, password: string, version: string, insecure?: boolean }|null}
 */
function getActiveCluster(clusterName) {
  const config = loadConfig();

  if (clusterName) {
    const cluster = config.clusters[clusterName];
    if (!cluster) return null;
    return { name: clusterName, ...cluster };
  }

  const activeName = config.activeCluster;
  if (!activeName || !config.clusters[activeName]) {
    return null;
  }

  return { name: activeName, ...config.clusters[activeName] };
}

/**
 * Returns the full cluster list and active cluster name.
 * @returns {{ activeCluster: string|null, clusters: Object }}
 */
function listClusters() {
  return loadConfig();
}

// ── Password masking ──────────────────────────────────────────────────────────

/**
 * Masks a password value with asterisks.
 * Secret Server placeholder references (<ss:ID:field>) are returned unchanged.
 * @param {string} password
 * @returns {string}
 */
function maskPassword(password) {
  if (!password) return password;
  if (SS_PLACEHOLDER_RE.test(password)) return password;
  return "*".repeat(password.length);
}

// ── Secret Server placeholder detection & resolution ─────────────────────────

/**
 * Returns true if any string value in the object matches a Secret Server placeholder.
 * Performs a deep check over all values.
 * @param {Object} obj
 * @returns {boolean}
 */
function hasSsPlaceholders(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && SS_PLACEHOLDER_RE.test(value)) {
      return true;
    }
    if (value !== null && typeof value === "object") {
      if (hasSsPlaceholders(value)) return true;
    }
  }
  return false;
}

/**
 * Resolves all Secret Server placeholders in an object by shelling out to ss-cli.
 * Placeholder format: <ss:ID:field>
 * Returns the object with placeholders replaced by their resolved values.
 * @param {Object} obj
 * @returns {Promise<Object>}
 */
async function resolveSsPlaceholders(obj) {
  if (!hasSsPlaceholders(obj)) {
    return obj;
  }

  const resolved = { ...obj };

  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      const match = value.match(/<ss:(\d+):([^>]+)>/);
      if (match) {
        const [, id, field] = match;
        resolved[key] = await resolveSsValue(id, field);
      }
    } else if (value !== null && typeof value === "object") {
      resolved[key] = await resolveSsPlaceholders(value);
    }
  }

  return resolved;
}

/**
 * Shells out to ss-cli to retrieve a single Secret Server field value.
 * @param {string} id - Secret ID.
 * @param {string} field - Field name.
 * @returns {Promise<string>}
 */
function resolveSsValue(id, field) {
  return new Promise((resolve, reject) => {
    execFile("ss-cli", ["get", id, "--format", "json"], (err, stdout, stderr) => {
      if (err) {
        if (err.code === "ENOENT" || (stderr && /not found/i.test(stderr))) {
          return reject(
            new Error(
              "ss-cli is not installed or not in PATH. " +
                "Please install ss-cli to resolve Secret Server placeholders. " +
                `Original error: ${err.message}`
            )
          );
        }
        return reject(new Error(`ss-cli failed for secret ${id}: ${err.message}`));
      }

      try {
        const data = JSON.parse(stdout);
        const fieldLower = field.toLowerCase();

        // First: check top-level keys (simple key-value secrets)
        const foundKey = Object.keys(data).find(
          (k) => k.toLowerCase() === fieldLower
        );
        if (foundKey !== undefined) {
          return resolve(data[foundKey]);
        }

        // Second: check items array (Secret Server template secrets)
        // Items have fieldName, slug, and itemValue properties
        if (Array.isArray(data.items)) {
          const item = data.items.find(
            (i) =>
              (i.slug && i.slug.toLowerCase() === fieldLower) ||
              (i.fieldName && i.fieldName.toLowerCase() === fieldLower)
          );
          if (item) {
            return resolve(item.itemValue);
          }
        }

        return reject(new Error(`Field "${field}" not found in secret ${id}`));
      } catch (parseErr) {
        reject(new Error(`Failed to parse ss-cli output for secret ${id}: ${parseErr.message}`));
      }
    });
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  VALID_VERSIONS,
  loadConfig,
  saveConfig,
  addCluster,
  useCluster,
  removeCluster,
  getActiveCluster,
  listClusters,
  maskPassword,
  hasSsPlaceholders,
  resolveSsPlaceholders,
};
