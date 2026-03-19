"use strict";

const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ── helpers ──────────────────────────────────────────────────────────────────

/** Resolve config module fresh so it picks up env-var changes. */
function freshConfig() {
  // Clear all cisco-axl cli cached modules
  Object.keys(require.cache).forEach((key) => {
    if (key.includes("cisco-axl") && key.includes("cli")) {
      delete require.cache[key];
    }
  });
  return require("../../cli/utils/config.js");
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "axl-cfg-test-"));
  process.env.CISCO_AXL_CONFIG_DIR = tmpDir;
});

afterEach(() => {
  delete process.env.CISCO_AXL_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── VALID_VERSIONS ────────────────────────────────────────────────────────────

describe("VALID_VERSIONS", () => {
  it("exports expected versions", () => {
    const { VALID_VERSIONS } = freshConfig();
    assert.deepEqual(VALID_VERSIONS, [
      "11.0",
      "11.5",
      "12.0",
      "12.5",
      "14.0",
      "15.0",
    ]);
  });
});

// ── loadConfig / saveConfig ───────────────────────────────────────────────────

describe("loadConfig", () => {
  it("returns empty default when no config file exists", () => {
    const { loadConfig } = freshConfig();
    const cfg = loadConfig();
    assert.deepEqual(cfg, { activeCluster: null, clusters: {} });
  });
});

describe("saveConfig / loadConfig round-trip", () => {
  it("persists and reloads config", () => {
    const { loadConfig, saveConfig } = freshConfig();
    const data = {
      activeCluster: "prod",
      clusters: {
        prod: { host: "10.0.0.1", username: "admin", password: "secret", version: "14.0" },
      },
    };
    saveConfig(data);
    const loaded = loadConfig();
    assert.deepEqual(loaded, data);
  });

  it("writes file with 0600 permissions", () => {
    const { saveConfig } = freshConfig();
    saveConfig({ activeCluster: null, clusters: {} });
    const cfgPath = path.join(tmpDir, "config.json");
    const stat = fs.statSync(cfgPath);
    const mode = stat.mode & 0o777;
    assert.equal(mode, 0o600);
  });
});

// ── addCluster ────────────────────────────────────────────────────────────────

describe("addCluster", () => {
  it("adds a cluster and returns updated config", () => {
    const { addCluster, loadConfig } = freshConfig();
    addCluster("dev", { host: "192.168.1.1", username: "admin", password: "pass", version: "12.5" });
    const cfg = loadConfig();
    assert.ok(cfg.clusters.dev);
    assert.equal(cfg.clusters.dev.host, "192.168.1.1");
    assert.equal(cfg.clusters.dev.version, "12.5");
  });

  it("first cluster becomes active automatically", () => {
    const { addCluster, loadConfig } = freshConfig();
    addCluster("first", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    const cfg = loadConfig();
    assert.equal(cfg.activeCluster, "first");
  });

  it("subsequent clusters do not override active", () => {
    const { addCluster, loadConfig } = freshConfig();
    addCluster("first", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    addCluster("second", { host: "2.2.2.2", username: "u", password: "p", version: "14.0" });
    const cfg = loadConfig();
    assert.equal(cfg.activeCluster, "first");
  });

  it("throws on invalid version", () => {
    const { addCluster } = freshConfig();
    assert.throws(
      () => addCluster("bad", { host: "1.1.1.1", username: "u", password: "p", version: "99.9" }),
      /invalid version/i
    );
  });

  it("stores optional insecure flag", () => {
    const { addCluster, loadConfig } = freshConfig();
    addCluster("ins", { host: "1.1.1.1", username: "u", password: "p", version: "14.0", insecure: true });
    const cfg = loadConfig();
    assert.equal(cfg.clusters.ins.insecure, true);
  });
});

// ── useCluster ────────────────────────────────────────────────────────────────

describe("useCluster", () => {
  it("switches active cluster", () => {
    const { addCluster, useCluster, loadConfig } = freshConfig();
    addCluster("a", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    addCluster("b", { host: "2.2.2.2", username: "u", password: "p", version: "14.0" });
    useCluster("b");
    const cfg = loadConfig();
    assert.equal(cfg.activeCluster, "b");
  });

  it("throws when cluster not found", () => {
    const { useCluster } = freshConfig();
    assert.throws(() => useCluster("nonexistent"), /not found/i);
  });
});

// ── removeCluster ─────────────────────────────────────────────────────────────

describe("removeCluster", () => {
  it("removes a cluster", () => {
    const { addCluster, removeCluster, loadConfig } = freshConfig();
    addCluster("a", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    removeCluster("a");
    const cfg = loadConfig();
    assert.equal(cfg.clusters.a, undefined);
  });

  it("throws when cluster not found", () => {
    const { removeCluster } = freshConfig();
    assert.throws(() => removeCluster("ghost"), /not found/i);
  });

  it("switches active to next available when active is removed", () => {
    const { addCluster, removeCluster, loadConfig } = freshConfig();
    addCluster("a", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    addCluster("b", { host: "2.2.2.2", username: "u", password: "p", version: "14.0" });
    // a is active; remove it
    removeCluster("a");
    const cfg = loadConfig();
    assert.equal(cfg.activeCluster, "b");
  });

  it("sets active to null when last cluster is removed", () => {
    const { addCluster, removeCluster, loadConfig } = freshConfig();
    addCluster("only", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    removeCluster("only");
    const cfg = loadConfig();
    assert.equal(cfg.activeCluster, null);
  });
});

// ── getActiveCluster ──────────────────────────────────────────────────────────

describe("getActiveCluster", () => {
  it("returns null when no clusters", () => {
    const { getActiveCluster } = freshConfig();
    assert.equal(getActiveCluster(), null);
  });

  it("returns active cluster with name field", () => {
    const { addCluster, getActiveCluster } = freshConfig();
    addCluster("prod", { host: "10.0.0.1", username: "admin", password: "secret", version: "14.0" });
    const cluster = getActiveCluster();
    assert.ok(cluster);
    assert.equal(cluster.name, "prod");
    assert.equal(cluster.host, "10.0.0.1");
  });

  it("returns named cluster when clusterName provided", () => {
    const { addCluster, getActiveCluster } = freshConfig();
    addCluster("a", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    addCluster("b", { host: "2.2.2.2", username: "u", password: "p", version: "14.0" });
    const cluster = getActiveCluster("b");
    assert.equal(cluster.name, "b");
    assert.equal(cluster.host, "2.2.2.2");
  });

  it("returns null when named cluster does not exist", () => {
    const { getActiveCluster } = freshConfig();
    assert.equal(getActiveCluster("missing"), null);
  });
});

// ── listClusters ──────────────────────────────────────────────────────────────

describe("listClusters", () => {
  it("returns activeCluster and clusters", () => {
    const { addCluster, listClusters } = freshConfig();
    addCluster("x", { host: "1.1.1.1", username: "u", password: "p", version: "14.0" });
    const result = listClusters();
    assert.equal(result.activeCluster, "x");
    assert.ok(result.clusters.x);
  });
});

// ── maskPassword ─────────────────────────────────────────────────────────────

describe("maskPassword", () => {
  it("replaces plain password with asterisks", () => {
    const { maskPassword } = freshConfig();
    const masked = maskPassword("mySecret123");
    assert.match(masked, /^\*+$/);
  });

  it("passes through ss references unchanged", () => {
    const { maskPassword } = freshConfig();
    const ssRef = "<ss:42:Password>";
    assert.equal(maskPassword(ssRef), ssRef);
  });

  it("passes through empty string", () => {
    const { maskPassword } = freshConfig();
    assert.equal(maskPassword(""), "");
  });
});

// ── hasSsPlaceholders ─────────────────────────────────────────────────────────

describe("hasSsPlaceholders", () => {
  it("returns true when an object value has ss placeholder", () => {
    const { hasSsPlaceholders } = freshConfig();
    assert.equal(hasSsPlaceholders({ password: "<ss:10:Password>" }), true);
  });

  it("returns false when no ss placeholders", () => {
    const { hasSsPlaceholders } = freshConfig();
    assert.equal(hasSsPlaceholders({ password: "plaintext" }), false);
  });

  it("detects placeholder nested in object", () => {
    const { hasSsPlaceholders } = freshConfig();
    assert.equal(
      hasSsPlaceholders({ a: "normal", b: "<ss:99:Field>" }),
      true
    );
  });
});

// ── resolveSsPlaceholders ─────────────────────────────────────────────────────

describe("resolveSsPlaceholders", () => {
  it("throws a descriptive error when ss-cli is not installed", async () => {
    const { resolveSsPlaceholders } = freshConfig();
    // Force a PATH that won't find ss-cli
    const origPath = process.env.PATH;
    process.env.PATH = "/nonexistent";
    try {
      await assert.rejects(
        () => resolveSsPlaceholders({ password: "<ss:1:Password>" }),
        /ss-cli/i
      );
    } finally {
      process.env.PATH = origPath;
    }
  });

  it("returns object unchanged when no placeholders", async () => {
    const { resolveSsPlaceholders } = freshConfig();
    const obj = { host: "10.0.0.1", username: "admin" };
    const result = await resolveSsPlaceholders(obj);
    assert.deepEqual(result, obj);
  });
});
