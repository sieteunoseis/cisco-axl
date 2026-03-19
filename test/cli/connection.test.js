"use strict";

const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ── helpers ───────────────────────────────────────────────────────────────────

/** Resolve connection module fresh so it picks up env-var changes. */
function freshConnection() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes("cisco-axl") && key.includes("cli")) {
      delete require.cache[key];
    }
  });
  return require("../../cli/utils/connection.js");
}

/** Write a minimal config file into tmpDir. */
function writeConfig(tmpDir, data) {
  const cfgPath = path.join(tmpDir, "config.json");
  fs.writeFileSync(cfgPath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

let tmpDir;

// Env vars to clear between tests
const ENV_KEYS = [
  "CUCM_HOST",
  "CUCM_HOSTNAME",
  "CUCM_USERNAME",
  "CUCM_PASSWORD",
  "CUCM_VERSION",
];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "axl-conn-test-"));
  process.env.CISCO_AXL_CONFIG_DIR = tmpDir;
  // Clear all CUCM env vars
  ENV_KEYS.forEach((k) => delete process.env[k]);
});

afterEach(() => {
  delete process.env.CISCO_AXL_CONFIG_DIR;
  ENV_KEYS.forEach((k) => delete process.env[k]);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── resolveConfig: flags override everything ──────────────────────────────────

describe("resolveConfig — flags override everything", () => {
  it("uses all flags when provided", async () => {
    // Also set env vars and a config file — flags should win
    process.env.CUCM_HOST = "env-host";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    process.env.CUCM_VERSION = "12.5";

    writeConfig(tmpDir, {
      activeCluster: "prod",
      clusters: {
        prod: {
          host: "cfg-host",
          username: "cfg-user",
          password: "cfg-pass",
          version: "11.5",
        },
      },
    });

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({
      host: "flag-host",
      username: "flag-user",
      password: "flag-pass",
      versionCucm: "14.0",
    });

    assert.equal(result.host, "flag-host");
    assert.equal(result.username, "flag-user");
    assert.equal(result.password, "flag-pass");
    assert.equal(result.version, "14.0");
  });
});

// ── resolveConfig: env vars used when no flags ────────────────────────────────

describe("resolveConfig — env vars used when no flags", () => {
  it("reads host, username, password, version from env vars", async () => {
    process.env.CUCM_HOST = "env-host";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    process.env.CUCM_VERSION = "12.5";

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({});

    assert.equal(result.host, "env-host");
    assert.equal(result.username, "env-user");
    assert.equal(result.password, "env-pass");
    assert.equal(result.version, "12.5");
  });
});

// ── resolveConfig: CUCM_HOSTNAME accepted as alias ────────────────────────────

describe("resolveConfig — CUCM_HOSTNAME alias", () => {
  it("accepts CUCM_HOSTNAME as alias for CUCM_HOST", async () => {
    process.env.CUCM_HOSTNAME = "hostname-alias";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    process.env.CUCM_VERSION = "14.0";

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({});

    assert.equal(result.host, "hostname-alias");
  });

  it("CUCM_HOST takes precedence over CUCM_HOSTNAME when both set", async () => {
    process.env.CUCM_HOST = "primary-host";
    process.env.CUCM_HOSTNAME = "alias-host";
    process.env.CUCM_USERNAME = "u";
    process.env.CUCM_PASSWORD = "p";
    process.env.CUCM_VERSION = "14.0";

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({});

    assert.equal(result.host, "primary-host");
  });
});

// ── resolveConfig: config file fallback ──────────────────────────────────────

describe("resolveConfig — config file fallback", () => {
  it("reads from active cluster when no flags or env vars", async () => {
    writeConfig(tmpDir, {
      activeCluster: "dev",
      clusters: {
        dev: {
          host: "cfg-host",
          username: "cfg-user",
          password: "cfg-pass",
          version: "15.0",
        },
      },
    });

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({});

    assert.equal(result.host, "cfg-host");
    assert.equal(result.username, "cfg-user");
    assert.equal(result.password, "cfg-pass");
    assert.equal(result.version, "15.0");
  });
});

// ── resolveConfig: partial flag override ─────────────────────────────────────

describe("resolveConfig — partial flag override", () => {
  it("uses flag host with env username (and config file for remainder)", async () => {
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    process.env.CUCM_VERSION = "12.5";

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({ host: "flag-host" });

    assert.equal(result.host, "flag-host");
    assert.equal(result.username, "env-user");
    assert.equal(result.password, "env-pass");
    assert.equal(result.version, "12.5");
  });
});

// ── resolveConfig: error when no config available ────────────────────────────

describe("resolveConfig — error when no config available", () => {
  it("throws a descriptive error when all sources are empty", async () => {
    // No flags, no env vars, no config file
    const { resolveConfig } = freshConnection();
    await assert.rejects(() => resolveConfig({}), /no.*config|missing|required/i);
  });

  it("throws when host is missing", async () => {
    process.env.CUCM_USERNAME = "u";
    process.env.CUCM_PASSWORD = "p";
    process.env.CUCM_VERSION = "14.0";

    const { resolveConfig } = freshConnection();
    await assert.rejects(() => resolveConfig({}), /host/i);
  });

  it("throws when username is missing", async () => {
    process.env.CUCM_HOST = "h";
    process.env.CUCM_PASSWORD = "p";
    process.env.CUCM_VERSION = "14.0";

    const { resolveConfig } = freshConnection();
    await assert.rejects(() => resolveConfig({}), /username/i);
  });

  it("throws when password is missing", async () => {
    process.env.CUCM_HOST = "h";
    process.env.CUCM_USERNAME = "u";
    process.env.CUCM_VERSION = "14.0";

    const { resolveConfig } = freshConnection();
    await assert.rejects(() => resolveConfig({}), /password/i);
  });

  it("throws when version is missing", async () => {
    process.env.CUCM_HOST = "h";
    process.env.CUCM_USERNAME = "u";
    process.env.CUCM_PASSWORD = "p";

    const { resolveConfig } = freshConnection();
    await assert.rejects(() => resolveConfig({}), /version/i);
  });
});

// ── resolveConfig: --cluster flag selects named cluster ──────────────────────

describe("resolveConfig — --cluster flag", () => {
  it("selects a specific named cluster from config", async () => {
    writeConfig(tmpDir, {
      activeCluster: "prod",
      clusters: {
        prod: {
          host: "prod-host",
          username: "prod-user",
          password: "prod-pass",
          version: "14.0",
        },
        staging: {
          host: "staging-host",
          username: "staging-user",
          password: "staging-pass",
          version: "12.5",
        },
      },
    });

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({ cluster: "staging" });

    assert.equal(result.host, "staging-host");
    assert.equal(result.username, "staging-user");
    assert.equal(result.password, "staging-pass");
    assert.equal(result.version, "12.5");
  });

  it("throws when specified cluster does not exist", async () => {
    writeConfig(tmpDir, {
      activeCluster: "prod",
      clusters: {
        prod: {
          host: "prod-host",
          username: "prod-user",
          password: "prod-pass",
          version: "14.0",
        },
      },
    });

    const { resolveConfig } = freshConnection();
    await assert.rejects(() => resolveConfig({ cluster: "nonexistent" }), /nonexistent|not found/i);
  });
});

// ── resolveConfig: insecure flag propagated ───────────────────────────────────

describe("resolveConfig — insecure flag", () => {
  it("propagates insecure: true from flags", async () => {
    process.env.CUCM_HOST = "h";
    process.env.CUCM_USERNAME = "u";
    process.env.CUCM_PASSWORD = "p";
    process.env.CUCM_VERSION = "14.0";

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({ insecure: true });

    assert.equal(result.insecure, true);
  });

  it("inherits insecure from config file cluster", async () => {
    writeConfig(tmpDir, {
      activeCluster: "dev",
      clusters: {
        dev: {
          host: "h",
          username: "u",
          password: "p",
          version: "14.0",
          insecure: true,
        },
      },
    });

    const { resolveConfig } = freshConnection();
    const result = await resolveConfig({});

    assert.equal(result.insecure, true);
  });
});
