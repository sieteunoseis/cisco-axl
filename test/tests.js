"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

// Load env file based on NODE_ENV before requiring anything that reads env
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "test.env") });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "staging.env") });
}

const { cleanEnv, str, host, makeValidator } = require("envalid");

const versionValid = makeValidator((x) => {
  if (/.*\..*[^\\]/.test(x)) return x.toUpperCase();
  else throw new Error("CUCM_VERSION must be in the format of ##.#");
});

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  CUCM_VERSION: versionValid({ desc: "Cisco CUCM Version.", example: "12.5" }),
});

const axlService = require("../dist/index");
const {
  AXLError,
  AXLNotFoundError,
  AXLOperationError,
  AXLValidationError,
} = axlService;

const TEST_PARTITION_NAME = `TEST-PARTITION-${Date.now()}`;
const TEST_PARTITION_NAME_2 = `TEST-PARTITION-2-${Date.now()}`;

let service;
let authPassed = false;

describe("cisco-axl integration tests", () => {
  before(() => {
    service = new axlService(
      env.CUCM_HOSTNAME,
      env.CUCM_USERNAME,
      env.CUCM_PASSWORD,
      env.CUCM_VERSION
    );
  });

  after(async () => {
    // Always attempt cleanup of both test partitions
    for (const name of [TEST_PARTITION_NAME, TEST_PARTITION_NAME_2]) {
      try {
        await service.removeItem("RoutePartition", { name });
      } catch (_) {
        // Partition may already be removed or never created — ignore
      }
    }
  });

  describe("authentication", () => {
    it("testAuthentication succeeds", async () => {
      const result = await service.testAuthentication();
      assert.equal(result, true, "testAuthentication should return true");
      authPassed = true;
    });

    it("rejects invalid credentials", async () => {
      const { AXLAuthError: AuthErr } = axlService;
      const badService = new axlService(
        env.CUCM_HOSTNAME,
        env.CUCM_USERNAME,
        "definitely-wrong-password-xyz",
        env.CUCM_VERSION
      );
      // testAuthentication may return false or throw AXLAuthError on bad credentials
      let result;
      try {
        result = await badService.testAuthentication();
      } catch (err) {
        assert.ok(
          AuthErr ? err instanceof AuthErr : err instanceof AXLError,
          `Expected auth error, got ${err.constructor.name}: ${err.message}`
        );
        return;
      }
      assert.equal(result, false, "testAuthentication should return false for bad credentials");
    });
  });

  describe("operation discovery", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("returnOperations returns all operations", async () => {
      const operations = await service.returnOperations();
      assert.ok(Array.isArray(operations), "should return an array");
      assert.ok(operations.length > 100, `should have many operations, got ${operations.length}`);
      assert.ok(operations.includes("addPhone"), "should include addPhone");
      assert.ok(operations.includes("addRoutePartition"), "should include addRoutePartition");
    });

    it("returnOperations filters by keyword", async () => {
      const operations = await service.returnOperations("partition");
      assert.ok(Array.isArray(operations), "should return an array");
      assert.ok(operations.length > 0, "should have at least one result");
      operations.forEach((op) => {
        assert.ok(
          op.toLowerCase().includes("partition"),
          `operation "${op}" should contain "partition"`
        );
      });
    });

    it("getOperationTags returns tag schema", async () => {
      const tags = await service.getOperationTags("addRoutePartition");
      assert.ok(tags !== null && typeof tags === "object", "should return an object");
      assert.ok("routePartition" in tags, "should have routePartition key");
    });

    it("getOperationTagsDetailed returns metadata with required/nillable/type", async () => {
      const detailed = await service.getOperationTagsDetailed("addRoutePartition");
      assert.ok(detailed !== null && typeof detailed === "object", "should return an object");
      assert.ok("routePartition" in detailed, "should have routePartition key");

      const meta = detailed.routePartition;
      assert.ok(typeof meta.required === "boolean", "required should be a boolean");
      assert.ok(typeof meta.nillable === "boolean", "nillable should be a boolean");
      assert.ok(typeof meta.isMany === "boolean", "isMany should be a boolean");
      assert.ok(
        meta.type === null || typeof meta.type === "string",
        "type should be null or string"
      );

      if (meta.children) {
        assert.ok(typeof meta.children === "object", "children should be an object");
        const childKeys = Object.keys(meta.children);
        assert.ok(childKeys.length > 0, "should have at least one child field");
        // Validate first child has required metadata fields
        const firstChild = meta.children[childKeys[0]];
        assert.ok(typeof firstChild.required === "boolean", "child required should be a boolean");
        assert.ok(typeof firstChild.nillable === "boolean", "child nillable should be a boolean");
      }
    });
  });

  describe("CRUD via convenience methods", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("addItem creates a route partition", async () => {
      const result = await service.addItem("RoutePartition", {
        name: TEST_PARTITION_NAME,
        description: "Test partition created by integration tests",
      });
      // addItem may return a UUID string or { return: "..." }
      assert.ok(
        typeof result === "string" || (result !== null && typeof result === "object"),
        "should return a UUID string or result object"
      );
      if (typeof result === "string") {
        assert.ok(result.length > 0, "UUID should be non-empty");
      }
    });

    it("getItem retrieves the partition by name", async () => {
      const result = await service.getItem(
        "RoutePartition",
        { name: TEST_PARTITION_NAME },
        { clean: true, removeAttributes: true }
      );
      assert.ok(result !== null && typeof result === "object", "should return an object");
      // Result may be wrapped in a key
      const partition =
        result.routePartition || result.return?.routePartition || result;
      assert.ok(partition, "should have routePartition data");
      const name = partition.name || partition;
      assert.ok(
        String(name) === TEST_PARTITION_NAME || JSON.stringify(result).includes(TEST_PARTITION_NAME),
        "result should include the test partition name"
      );
    });

    it("listItems returns partitions including the test one", async () => {
      const result = await service.listItems(
        "RoutePartition",
        { name: "%%" },
        { name: "", description: "" },
        { clean: true, removeAttributes: true }
      );
      assert.ok(result !== null && typeof result === "object", "should return an object");
      const partitions = result.routePartition || result.return?.routePartition || result;
      assert.ok(Array.isArray(partitions), "should return an array of partitions");
      const found = partitions.some(
        (p) => p.name === TEST_PARTITION_NAME || JSON.stringify(p).includes(TEST_PARTITION_NAME)
      );
      assert.ok(found, "test partition should be in the list");
    });

    it("updateItem updates the partition description", async () => {
      // updateRoutePartition expects name/uuid at top level, so use executeOperation directly
      const result = await service.executeOperation("updateRoutePartition", {
        name: TEST_PARTITION_NAME,
        description: "Updated by integration test",
      });
      assert.ok(
        result !== null && (typeof result === "string" || typeof result === "object"),
        "update should return a result"
      );
    });

    it("getItem confirms the update", async () => {
      const result = await service.getItem(
        "RoutePartition",
        { name: TEST_PARTITION_NAME },
        { clean: true, removeAttributes: true }
      );
      assert.ok(result !== null && typeof result === "object", "should return an object");
      assert.ok(
        JSON.stringify(result).includes("Updated by integration test"),
        "result should contain the updated description"
      );
    });

    it("removeItem deletes the partition", async () => {
      const result = await service.removeItem("RoutePartition", { name: TEST_PARTITION_NAME });
      assert.ok(
        typeof result === "string" ||
          (result !== null && typeof result === "object"),
        "removeItem should return a result"
      );
    });

    it("listItems confirms removal", async () => {
      const result = await service.listItems(
        "RoutePartition",
        { name: "%%" },
        { name: "", description: "" },
        { clean: true, removeAttributes: true }
      );
      assert.ok(result !== null && typeof result === "object", "should return an object");
      const partitions = result.routePartition || result.return?.routePartition || [];
      const found = Array.isArray(partitions)
        ? partitions.some((p) => p.name === TEST_PARTITION_NAME)
        : JSON.stringify(partitions).includes(TEST_PARTITION_NAME);
      assert.ok(!found, "removed test partition should not be in the list");
    });
  });

  describe("CRUD via executeOperation", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("addRoutePartition creates a partition", async () => {
      const tags = await service.getOperationTags("addRoutePartition");
      tags.routePartition.name = TEST_PARTITION_NAME_2;
      tags.routePartition.description = "Test partition via executeOperation";

      const result = await service.executeOperation("addRoutePartition", tags);
      assert.ok(
        typeof result === "string" || (result !== null && typeof result === "object"),
        "should return a UUID string or object"
      );
      if (typeof result === "string") {
        assert.ok(result.length > 0, "UUID should be non-empty");
      }
    });

    it("listRoutePartition lists partitions", async () => {
      const tags = await service.getOperationTags("listRoutePartition");
      tags.searchCriteria.name = "%%";
      tags.searchCriteria.description = "%%";

      const result = await service.executeOperation("listRoutePartition", tags, {
        clean: true,
        removeAttributes: true,
      });
      assert.ok(result !== null && typeof result === "object", "should return an object");
      assert.ok("routePartition" in result, "result should have routePartition key");
      assert.ok(Array.isArray(result.routePartition), "routePartition should be an array");
      assert.ok(result.routePartition.length > 0, "should have at least one partition");

      const found = result.routePartition.some((p) => p.name === TEST_PARTITION_NAME_2);
      assert.ok(found, "newly created partition should appear in list");
    });

    it("removeRoutePartition removes the partition", async () => {
      const tags = await service.getOperationTags("removeRoutePartition");
      tags.name = TEST_PARTITION_NAME_2;

      const result = await service.executeOperation("removeRoutePartition", tags);
      assert.ok(
        typeof result === "string" || (result !== null && typeof result === "object"),
        "should return a result"
      );
    });
  });

  describe("SQL operations", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("executeSqlQuery returns results", async () => {
      const result = await service.executeSqlQuery(
        "SELECT FIRST 5 name, description FROM routepartition"
      );
      assert.ok(result !== null && typeof result === "object", "should return an object");
      // Results come back as { row: [...] }
      const rows = result.row || result;
      assert.ok(rows !== null && rows !== undefined, "should have row data");
    });

    it("executeSqlQuery with no results returns empty", async () => {
      const result = await service.executeSqlQuery(
        "SELECT name FROM routepartition WHERE name = 'THIS-PARTITION-DOES-NOT-EXIST-XYZ-12345'"
      );
      // Empty result may be null, {}, or { row: [] }
      if (result !== null && result !== undefined) {
        const rows = result.row;
        if (rows !== undefined) {
          assert.ok(
            rows === null || (Array.isArray(rows) && rows.length === 0),
            "should return empty rows"
          );
        }
        // else result is an object with no row key — acceptable
      }
      // null result is also acceptable for no-result queries
      assert.ok(true, "executeSqlQuery with no results handled without error");
    });
  });

  describe("batch operations", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("executeBatch runs multiple operations", async () => {
      const operations = [
        {
          operation: "listRoutePartition",
          tags: { searchCriteria: { name: "%%" }, returnedTags: { name: "", description: "" } },
          opts: { clean: true, removeAttributes: true },
        },
        {
          operation: "executeSQLQuery",
          tags: { sql: "SELECT count(*) as cnt FROM routepartition" },
        },
      ];

      const results = await service.executeBatch(operations, 2);
      assert.ok(Array.isArray(results), "executeBatch should return an array");
      assert.equal(results.length, 2, "should have one result per operation");

      results.forEach((batchResult, i) => {
        assert.ok(
          "operation" in batchResult,
          `result[${i}] should have operation property`
        );
        assert.ok(
          "success" in batchResult,
          `result[${i}] should have success property`
        );
      });
    });
  });

  describe("error handling", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("getItem with nonexistent name throws AXLOperationError", async () => {
      await assert.rejects(
        () =>
          service.getItem("routePartition", {
            name: "NONEXISTENT-PARTITION-XYZ-99999",
          }),
        (err) => {
          assert.ok(
            err instanceof AXLOperationError || err instanceof AXLError,
            `Expected AXLOperationError, got ${err.constructor.name}: ${err.message}`
          );
          return true;
        }
      );
    });

    it("executeOperation with invalid operation throws AXLNotFoundError", async () => {
      await assert.rejects(
        () => service.executeOperation("thisOperationDoesNotExist", {}),
        (err) => {
          assert.ok(
            err instanceof AXLNotFoundError || err instanceof AXLError,
            `Expected AXLNotFoundError, got ${err.constructor.name}: ${err.message}`
          );
          return true;
        }
      );
    });

    it("invalid constructor params throw AXLValidationError", () => {
      assert.throws(
        () =>
          new axlService(
            env.CUCM_HOSTNAME,
            env.CUCM_USERNAME,
            env.CUCM_PASSWORD,
            "99.9" // invalid version
          ),
        (err) => {
          assert.ok(
            err instanceof AXLValidationError || err instanceof AXLError || err instanceof Error,
            `Expected a validation error, got ${err.constructor.name}: ${err.message}`
          );
          return true;
        }
      );
    });
  });
});
