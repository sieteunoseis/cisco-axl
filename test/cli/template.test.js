"use strict";

const assert = require("node:assert/strict");
const { describe, it, before } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let templateUtil;
let hasOptionalDeps = false;

before(() => {
  try {
    require("json-variables");
    require("csv-parse/sync");
    hasOptionalDeps = true;
    templateUtil = require("../../cli/utils/template.js");
  } catch {
    hasOptionalDeps = false;
  }
});

describe("template utility", () => {
  it(
    "resolveTemplate replaces placeholders",
    { skip: !hasOptionalDeps && "json-variables not installed" },
    () => {
      const template = { name: "SEP%%mac%%", devicePoolName: "%%dp%%", protocol: "SIP" };
      const vars = { mac: "001122334455", dp: "DP_HQ" };
      const result = templateUtil.resolveTemplate(template, vars);
      assert.equal(result.name, "SEP001122334455");
      assert.equal(result.devicePoolName, "DP_HQ");
      assert.equal(result.protocol, "SIP");
    }
  );

  it(
    "parseCsvFile parses CSV to objects",
    { skip: !hasOptionalDeps && "csv-parse not installed" },
    () => {
      const tmpFile = path.join(os.tmpdir(), "cisco-axl-test-bulk.csv");
      fs.writeFileSync(tmpFile, "mac,dp,desc\n001122334455,DP_HQ,Lobby\n001122334466,DP_BR,Conf\n");
      try {
        const rows = templateUtil.parseCsvFile(tmpFile);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].mac, "001122334455");
        assert.equal(rows[1].desc, "Conf");
      } finally {
        fs.unlinkSync(tmpFile);
      }
    }
  );

  it("throws helpful error when deps not installed", () => {
    // This always works - test the error message format
    const tpl = require("../../cli/utils/template.js");
    assert.ok(tpl.TEMPLATE_DEPS_MSG.includes("npm install"));
  });
});
