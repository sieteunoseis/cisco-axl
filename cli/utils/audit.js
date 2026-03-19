"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const AUDIT_FILE = "audit.jsonl";
const ROTATION_THRESHOLD = 10 * 1024 * 1024; // 10 MB

/** Credential fields that must never be logged. */
const REDACTED_FIELDS = new Set(["password", "username", "user", "pass", "secret", "token", "auth"]);

/**
 * Resolve the config directory, honoring CISCO_AXL_CONFIG_DIR env var.
 * @returns {string}
 */
function getConfigDir() {
  return process.env.CISCO_AXL_CONFIG_DIR || path.join(os.homedir(), ".cisco-axl");
}

/**
 * Sanitize an entry object, removing any credential fields.
 * @param {object} entry
 * @returns {object}
 */
function sanitize(entry) {
  if (!entry || typeof entry !== "object") return {};
  const safe = {};
  for (const [key, val] of Object.entries(entry)) {
    if (!REDACTED_FIELDS.has(key.toLowerCase())) {
      safe[key] = val;
    }
  }
  return safe;
}

/**
 * Append a JSON line to the audit log.
 * Automatically adds a timestamp. Never throws.
 * @param {{ cluster: string, operation: string, duration_ms: number, status: string, rows?: number, error?: string, totalCount?: number, successCount?: number, failureCount?: number }} entry
 * @returns {Promise<void>}
 */
async function logAudit(entry) {
  try {
    const safe = sanitize(entry);
    const record = { timestamp: new Date().toISOString(), ...safe };
    const line = JSON.stringify(record) + "\n";

    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, AUDIT_FILE);
    fs.appendFileSync(filePath, line, "utf8");
  } catch {
    // Fire-and-forget: silently ignore all failures
  }
}

/**
 * Rotate the audit log if it exceeds 10 MB.
 * Keeps the current file and one backup (.1).
 * Never throws.
 * @returns {Promise<void>}
 */
async function rotateAuditLog() {
  try {
    const dir = getConfigDir();
    const filePath = path.join(dir, AUDIT_FILE);

    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    if (stat.size <= ROTATION_THRESHOLD) return;

    const rotatedPath = path.join(dir, AUDIT_FILE + ".1");
    // Remove old backup if it exists
    if (fs.existsSync(rotatedPath)) {
      fs.unlinkSync(rotatedPath);
    }
    // Rename current log to backup
    fs.renameSync(filePath, rotatedPath);
    // Create a fresh empty log
    fs.writeFileSync(filePath, "", "utf8");
  } catch {
    // Fire-and-forget: silently ignore all failures
  }
}

module.exports = { logAudit, rotateAuditLog };
