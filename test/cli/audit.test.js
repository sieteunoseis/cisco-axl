"use strict";

const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ── helpers ───────────────────────────────────────────────────────────────────

/** Fresh require of audit module, picks up CISCO_AXL_CONFIG_DIR changes. */
function freshAudit() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes("cisco-axl") && key.includes("audit")) {
      delete require.cache[key];
    }
  });
  return require("../../cli/utils/audit.js");
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "axl-audit-test-"));
  process.env.CISCO_AXL_CONFIG_DIR = tmpDir;
});

afterEach(() => {
  delete process.env.CISCO_AXL_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── logAudit: basic write ─────────────────────────────────────────────────────

describe("logAudit — writes JSONL entry", () => {
  it("creates audit.jsonl in the config dir", async () => {
    const { logAudit } = freshAudit();
    await logAudit({ cluster: "dev", operation: "getPhone", duration_ms: 42, status: "success" });

    const auditPath = path.join(tmpDir, "audit.jsonl");
    assert.ok(fs.existsSync(auditPath), "audit.jsonl should exist");
  });

  it("written entry parses as valid JSON", async () => {
    const { logAudit } = freshAudit();
    await logAudit({ cluster: "dev", operation: "getPhone", duration_ms: 42, status: "success" });

    const auditPath = path.join(tmpDir, "audit.jsonl");
    const line = fs.readFileSync(auditPath, "utf8").trim();
    const parsed = JSON.parse(line);
    assert.equal(parsed.operation, "getPhone");
    assert.equal(parsed.status, "success");
    assert.equal(parsed.cluster, "dev");
    assert.equal(parsed.duration_ms, 42);
  });

  it("adds a timestamp field automatically", async () => {
    const { logAudit } = freshAudit();
    const before = new Date().toISOString();
    await logAudit({ cluster: "dev", operation: "listPhones", duration_ms: 10, status: "success" });
    const after = new Date().toISOString();

    const auditPath = path.join(tmpDir, "audit.jsonl");
    const parsed = JSON.parse(fs.readFileSync(auditPath, "utf8").trim());
    assert.ok(parsed.timestamp, "entry must have a timestamp");
    assert.ok(parsed.timestamp >= before, "timestamp not before operation");
    assert.ok(parsed.timestamp <= after, "timestamp not after operation");
  });

  it("appends multiple entries, one per line", async () => {
    const { logAudit } = freshAudit();
    await logAudit({ cluster: "dev", operation: "op1", duration_ms: 1, status: "success" });
    await logAudit({ cluster: "dev", operation: "op2", duration_ms: 2, status: "error" });

    const auditPath = path.join(tmpDir, "audit.jsonl");
    const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).operation, "op1");
    assert.equal(JSON.parse(lines[1]).operation, "op2");
  });

  it("creates the config directory if it does not exist", async () => {
    const nestedDir = path.join(tmpDir, "nested", "deep");
    process.env.CISCO_AXL_CONFIG_DIR = nestedDir;
    const { logAudit } = freshAudit();
    await logAudit({ cluster: "x", operation: "op", duration_ms: 5, status: "success" });

    const auditPath = path.join(nestedDir, "audit.jsonl");
    assert.ok(fs.existsSync(auditPath));
  });

  it("includes optional fields when provided", async () => {
    const { logAudit } = freshAudit();
    await logAudit({
      cluster: "prod",
      operation: "listPhones",
      duration_ms: 200,
      status: "success",
      rows: 50,
      totalCount: 100,
      successCount: 45,
      failureCount: 5,
    });

    const auditPath = path.join(tmpDir, "audit.jsonl");
    const parsed = JSON.parse(fs.readFileSync(auditPath, "utf8").trim());
    assert.equal(parsed.rows, 50);
    assert.equal(parsed.totalCount, 100);
    assert.equal(parsed.successCount, 45);
    assert.equal(parsed.failureCount, 5);
  });

  it("does not log passwords or usernames", async () => {
    const { logAudit } = freshAudit();
    // Even if caller passes creds by mistake, they must not appear
    await logAudit({
      cluster: "prod",
      operation: "getPhone",
      duration_ms: 10,
      status: "success",
      password: "secret123",
      username: "admin",
    });

    const auditPath = path.join(tmpDir, "audit.jsonl");
    const raw = fs.readFileSync(auditPath, "utf8");
    assert.ok(!raw.includes("secret123"), "password must not be logged");
    assert.ok(!raw.includes("admin"), "username must not be logged");
  });
});

// ── logAudit: fire-and-forget / never throws ──────────────────────────────────

describe("logAudit — never throws", () => {
  it("does not throw on invalid data", async () => {
    const { logAudit } = freshAudit();
    // Should complete without throwing
    await assert.doesNotReject(() => logAudit(null));
    await assert.doesNotReject(() => logAudit(undefined));
    await assert.doesNotReject(() => logAudit({ circular: null }));
  });

  it("does not throw when config dir is unwritable", async () => {
    // Point to a path that cannot be created (file in place of dir)
    const filePath = path.join(tmpDir, "blocker");
    fs.writeFileSync(filePath, "block");
    process.env.CISCO_AXL_CONFIG_DIR = filePath; // dir is actually a file
    const { logAudit } = freshAudit();
    await assert.doesNotReject(() =>
      logAudit({ cluster: "x", operation: "y", duration_ms: 1, status: "error" })
    );
  });
});

// ── rotateAuditLog ────────────────────────────────────────────────────────────

describe("rotateAuditLog — rotation", () => {
  it("does not rotate when file is below threshold", async () => {
    const { logAudit, rotateAuditLog } = freshAudit();
    await logAudit({ cluster: "dev", operation: "op", duration_ms: 1, status: "success" });
    await rotateAuditLog();

    const auditPath = path.join(tmpDir, "audit.jsonl");
    const rotatedPath = path.join(tmpDir, "audit.jsonl.1");
    assert.ok(fs.existsSync(auditPath), "original should still exist");
    assert.ok(!fs.existsSync(rotatedPath), "rotated file should not exist");
  });

  it("rotates when file exceeds 10MB", async () => {
    const auditPath = path.join(tmpDir, "audit.jsonl");
    // Write 11MB of data
    const bigLine = JSON.stringify({ cluster: "x", operation: "y", timestamp: new Date().toISOString() });
    const needed = Math.ceil((11 * 1024 * 1024) / (bigLine.length + 1));
    const content = (bigLine + "\n").repeat(needed);
    fs.writeFileSync(auditPath, content);

    const { rotateAuditLog } = freshAudit();
    await rotateAuditLog();

    const rotatedPath = path.join(tmpDir, "audit.jsonl.1");
    assert.ok(fs.existsSync(rotatedPath), "rotated file should exist");
    // Original is removed or recreated empty
    if (fs.existsSync(auditPath)) {
      const size = fs.statSync(auditPath).size;
      assert.ok(size < 11 * 1024 * 1024, "original should be truncated/empty after rotation");
    }
  });

  it("does not throw when audit file does not exist", async () => {
    const { rotateAuditLog } = freshAudit();
    await assert.doesNotReject(() => rotateAuditLog());
  });

  it("does not throw when config dir does not exist", async () => {
    process.env.CISCO_AXL_CONFIG_DIR = path.join(tmpDir, "nonexistent");
    const { rotateAuditLog } = freshAudit();
    await assert.doesNotReject(() => rotateAuditLog());
  });
});
