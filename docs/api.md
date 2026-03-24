# Library API Reference

## Setup

```javascript
const axlService = require("cisco-axl");

let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

// With options
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0", {
  logging: { level: "info" },
  retry: { retries: 3, retryDelay: 1000 }
});
```

## ESM / TypeScript

```javascript
// CommonJS
const axlService = require("cisco-axl");

// ESM
import axlService from "cisco-axl";
import { AXLAuthError, AXLOperationError } from "cisco-axl";
```

```typescript
import axlService from 'cisco-axl';

const service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

const tags = await service.getOperationTags("listRoutePartition");
tags.searchCriteria.name = "%%";
const result = await service.executeOperation("listRoutePartition", tags);
```

See the `examples/typescript` directory for more examples.

## Logging

```javascript
// Via environment variable
// DEBUG=true

// Via constructor
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0", {
  logging: {
    level: "info",  // "error" | "warn" | "info" | "debug"
    handler: (level, message, data) => {
      myLogger[level](message, data);
    }
  }
});

// Change at runtime
service.setLogLevel("debug");
```

## Convenience Methods

```javascript
// Get a single item by name or UUID
await service.getItem("Phone", "SEP001122334455");
await service.getItem("Phone", { uuid: "abc-123" });

// List items with search criteria and returned tags
await service.listItems("RoutePartition");  // all partitions
await service.listItems("Phone", { name: "SEP%" }, { name: "", model: "" });

// Add, update, remove
await service.addItem("RoutePartition", { name: "NEW-PT", description: "New" });
await service.updateItem("Phone", "SEP001122334455", { description: "Updated" });
await service.removeItem("RoutePartition", "NEW-PT");

// SQL
const rows = await service.executeSqlQuery("SELECT name FROM routepartition");
await service.executeSqlUpdate("UPDATE routepartition SET description='test' WHERE name='NEW-PT'");
```

## Operation Discovery

```javascript
// List all operations
const ops = await service.returnOperations();
const phoneOps = await service.returnOperations("phone");

// Get tag schema
const tags = await service.getOperationTags("addRoutePartition");

// Get detailed metadata (required, nillable, type)
const detailed = await service.getOperationTagsDetailed("addRoutePartition");
console.log(detailed.routePartition.required);  // true
console.log(detailed.routePartition.children.name.type);  // "string"
```

## Execute Any Operation

```javascript
const tags = await service.getOperationTags("addRoutePartition");
tags.routePartition.name = "INTERNAL-PT";
tags.routePartition.description = "Internal directory numbers";

const result = await service.executeOperation("addRoutePartition", tags);
console.log("UUID:", result);
```

## Batch Operations

```javascript
const results = await service.executeBatch([
  { operation: "getPhone", tags: { name: "SEP001122334455" } },
  { operation: "getPhone", tags: { name: "SEP556677889900" } },
], 5); // concurrency limit

results.forEach((r) => {
  console.log(r.success ? `${r.operation}: OK` : `${r.operation}: ${r.error.message}`);
});
```

## Error Handling

```javascript
const { AXLAuthError, AXLNotFoundError, AXLOperationError, AXLValidationError } = require("cisco-axl");

try {
  await service.executeOperation("getPhone", { name: "INVALID" });
} catch (error) {
  if (error instanceof AXLAuthError) console.log("Bad credentials");
  else if (error instanceof AXLNotFoundError) console.log("Operation not found:", error.operation);
  else if (error instanceof AXLOperationError) console.log("SOAP fault:", error.message);
  else if (error instanceof AXLValidationError) console.log("Invalid input:", error.message);
}
```

## Retry Configuration

```javascript
let service = new axlService("10.10.20.1", "admin", "pass", "14.0", {
  retry: {
    retries: 3,
    retryDelay: 1000,
    retryOn: (error) => error.message.includes("ECONNRESET")
  }
});
```

## json-variables Support

```javascript
var lineTemplate = {
  pattern: "%%_extension_%%",
  alertingName: "%%_firstName_%% %%_lastName_%%",
  description: "%%_firstName_%% %%_lastName_%%",
  _data: {
    extension: "1001",
    firstName: "Tom",
    lastName: "Smith",
  },
};

const lineTags = jVar(lineTemplate);
await service.executeOperation("updateLine", lineTags);
```

## Methods Reference

### Core

| Method | Description |
|--------|-------------|
| `new axlService(host, user, pass, version, opts?)` | Constructor |
| `testAuthentication()` | Test credentials against AXL endpoint |
| `returnOperations(filter?)` | List available operations |
| `getOperationTags(operation)` | Get tag schema for an operation |
| `getOperationTagsDetailed(operation)` | Get detailed tag metadata (required/nillable/type) |
| `executeOperation(operation, tags, opts?)` | Execute any AXL operation |
| `executeBatch(operations[], concurrency?)` | Parallel batch execution |
| `setLogLevel(level)` | Change log level at runtime |

### Convenience

| Method | Description |
|--------|-------------|
| `getItem(type, identifier, opts?)` | Get single item by name or UUID |
| `listItems(type, search?, returnedTags?, opts?)` | List items with filtering |
| `addItem(type, data, opts?)` | Add a new item |
| `updateItem(type, identifier, updates, opts?)` | Update an existing item |
| `removeItem(type, identifier, opts?)` | Remove an item |
| `executeSqlQuery(sql)` | Run a SQL SELECT query |
| `executeSqlUpdate(sql)` | Run a SQL INSERT/UPDATE/DELETE |
