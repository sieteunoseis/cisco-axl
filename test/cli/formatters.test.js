"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const SAMPLE_LIST = [
  { name: "SEP001122334455", model: "Cisco 8845", description: "Lobby Phone" },
  { name: "SEP001122334466", model: "Cisco 8861", description: "Conf Room A" },
];

const SAMPLE_SINGLE = {
  name: "SEP001122334455",
  model: "Cisco 8845",
  description: "Lobby Phone",
};

// ── json formatter ─────────────────────────────────────────────────────────────

describe("formatJson", () => {
  const { formatJson } = require("../../cli/formatters/json.js");

  it("returns a string", () => {
    assert.equal(typeof formatJson(SAMPLE_LIST), "string");
  });

  it("list output round-trips through JSON.parse", () => {
    const parsed = JSON.parse(formatJson(SAMPLE_LIST));
    assert.deepEqual(parsed, SAMPLE_LIST);
  });

  it("single item output round-trips through JSON.parse", () => {
    const parsed = JSON.parse(formatJson(SAMPLE_SINGLE));
    assert.deepEqual(parsed, SAMPLE_SINGLE);
  });

  it("is pretty-printed (contains newlines)", () => {
    const out = formatJson(SAMPLE_LIST);
    assert.ok(out.includes("\n"), "expected newlines in pretty output");
  });
});

// ── csv formatter ─────────────────────────────────────────────────────────────

describe("formatCsv", () => {
  const { formatCsv } = require("../../cli/formatters/csv.js");

  it("returns a string", () => {
    assert.equal(typeof formatCsv(SAMPLE_LIST), "string");
  });

  it("list: first line is the header row", () => {
    const lines = formatCsv(SAMPLE_LIST).trim().split("\n");
    const header = lines[0];
    assert.ok(header.includes("name"), `header missing 'name': ${header}`);
    assert.ok(header.includes("model"), `header missing 'model': ${header}`);
    assert.ok(header.includes("description"), `header missing 'description': ${header}`);
  });

  it("list: correct total row count (header + data rows)", () => {
    const lines = formatCsv(SAMPLE_LIST).trim().split("\n");
    // 1 header + 2 data rows = 3
    assert.equal(lines.length, 3);
  });

  it("single item: wraps in array, still has header + 1 data row", () => {
    const lines = formatCsv(SAMPLE_SINGLE).trim().split("\n");
    assert.equal(lines.length, 2);
  });

  it("list: data values appear in output", () => {
    const out = formatCsv(SAMPLE_LIST);
    assert.ok(out.includes("SEP001122334455"));
    assert.ok(out.includes("Cisco 8861"));
  });
});

// ── table formatter ────────────────────────────────────────────────────────────

describe("formatTable", () => {
  const { formatTable } = require("../../cli/formatters/table.js");

  it("returns a string", () => {
    assert.equal(typeof formatTable(SAMPLE_LIST), "string");
  });

  it("list: contains a data value", () => {
    const out = formatTable(SAMPLE_LIST);
    assert.ok(out.includes("SEP001122334455"), "expected device name in table output");
  });

  it("list: footer shows 'results found'", () => {
    const out = formatTable(SAMPLE_LIST);
    assert.ok(out.toLowerCase().includes("results found"), `expected 'results found' in:\n${out}`);
  });

  it("list: shows correct result count", () => {
    const out = formatTable(SAMPLE_LIST);
    assert.ok(out.includes("2"), "expected count '2' in table footer");
  });

  it("single object: contains key names", () => {
    const out = formatTable(SAMPLE_SINGLE);
    assert.ok(out.includes("name"), "expected key 'name'");
    assert.ok(out.includes("model"), "expected key 'model'");
  });

  it("single object: contains value", () => {
    const out = formatTable(SAMPLE_SINGLE);
    assert.ok(out.includes("SEP001122334455"));
  });

  it("empty array: returns 'No results found'", () => {
    const out = formatTable([]);
    assert.equal(out, "No results found");
  });
});

// ── toon formatter ─────────────────────────────────────────────────────────────

describe("formatToon", () => {
  it("returns a string shorter than json output", async () => {
    // toon formatter uses dynamic import so we await the module
    const { formatToon } = require("../../cli/formatters/toon.js");
    const toonOut = await formatToon(SAMPLE_LIST);
    const jsonOut = JSON.stringify(SAMPLE_LIST);
    assert.equal(typeof toonOut, "string");
    assert.ok(
      toonOut.length < jsonOut.length,
      `expected toon (${toonOut.length}) to be shorter than json (${jsonOut.length})`
    );
  });

  it("single item: returns a string", async () => {
    const { formatToon } = require("../../cli/formatters/toon.js");
    const out = await formatToon(SAMPLE_SINGLE);
    assert.equal(typeof out, "string");
    assert.ok(out.length > 0);
  });
});
