# Cisco AXL Library & CLI

A JavaScript library and CLI to interact with Cisco CUCM via AXL SOAP API. Dynamically discovers all AXL operations from the WSDL schema — any operation for your specified version is available without static definitions.

Administrative XML (AXL) information can be found at:
[Administrative XML (AXL) Reference](https://developer.cisco.com/docs/axl/#!axl-developer-guide).

## Installation

```bash
npm install cisco-axl
```

### Global CLI install

```bash
npm install -g cisco-axl
```

Or run without installing:

```bash
npx cisco-axl --help
```

### AI Agent Skills

```bash
npx skillsadd sieteunoseis/cisco-axl
```

## Requirements

If you are using self-signed certificates on Cisco VOS products you may need to disable TLS verification, or use the `--insecure` CLI flag.

Supported CUCM versions: `11.0`, `11.5`, `12.0`, `12.5`, `14.0`, `15.0`

## CLI

The CLI provides full AXL access from the command line — CRUD operations, SQL queries, operation discovery, bulk provisioning from CSV, and a raw execute escape hatch for any AXL operation.

### Quick Start

```bash
# Configure a cluster
cisco-axl config add lab --host 10.0.0.1 --username admin --password secret --cucm-version 14.0 --insecure

# Test the connection
cisco-axl config test

# List phones
cisco-axl list Phone --search "name=SEP%"

# Get a specific phone
cisco-axl get Phone SEP001122334455 --returned-tags "name,model,description"

# SQL query
cisco-axl sql query "SELECT name, description FROM device WHERE name LIKE 'SEP%'"

# Discover available operations
cisco-axl operations --filter phone
cisco-axl operations --type action --filter phone

# Describe what tags an operation needs
cisco-axl describe getPhone --detailed

# Execute any AXL operation
cisco-axl execute doLdapSync --tags '{"name":"LDAP_Main"}'
```

### Commands

| Command | Description |
|---------|-------------|
| `config add/use/list/show/remove/test` | Manage multi-cluster configurations |
| `get <type> <identifier>` | Get a single item |
| `list <type>` | List items with search, pagination, returned tags |
| `add <type>` | Add an item (inline JSON, template, or bulk CSV) |
| `update <type> <identifier>` | Update an item |
| `remove <type> <identifier>` | Remove an item |
| `sql query/update` | Execute SQL against CUCM |
| `execute <operation>` | Run any raw AXL operation |
| `operations` | List available operations with `--filter` and `--type crud\|action` |
| `describe <operation>` | Show tag schema with `--detailed` for required/optional/type info |

### Configuration

```bash
# Multiple clusters
cisco-axl config add lab --host 10.0.0.1 --username admin --password secret --cucm-version 14.0 --insecure
cisco-axl config add prod --host 10.0.0.2 --username axladmin --password secret --cucm-version 15.0 --insecure
cisco-axl config use prod
cisco-axl config list

# Per-command cluster override
cisco-axl list Phone --search "name=SEP%" --cluster lab

# Environment variables (CI/CD, AI agents)
export CUCM_HOST=10.0.0.1 CUCM_USERNAME=admin CUCM_PASSWORD=secret CUCM_VERSION=14.0
```

Config stored at `~/.cisco-axl/config.json`. Supports optional [Secret Server](https://github.com/sieteunoseis/ss-cli) integration via `<ss:ID:field>` placeholders.

### Output Formats

```bash
cisco-axl list Phone --search "name=SEP%" --format table  # default, human-readable
cisco-axl list Phone --search "name=SEP%" --format json   # structured JSON
cisco-axl list Phone --search "name=SEP%" --format toon   # token-efficient for AI agents
cisco-axl list Phone --search "name=SEP%" --format csv    # spreadsheet export
```

### Bulk Operations from CSV

Requires optional packages: `npm install json-variables csv-parse`

```bash
# Bulk add phones from template + CSV
cisco-axl add Phone --template phone-template.json --csv phones.csv
cisco-axl add Phone --template phone-template.json --csv phones.csv --dry-run  # preview first

# Single template with inline vars
cisco-axl add Phone --template phone-template.json --vars '{"mac":"001122334455","dp":"DP_HQ"}'
```

Template file (`phone-template.json`):
```json
{
  "name": "SEP%%mac%%",
  "devicePoolName": "%%devicePool%%",
  "description": "%%description%%",
  "protocol": "SIP"
}
```

### Global Flags

```
--format table|json|toon|csv   Output format (default: table)
--insecure                     Skip TLS certificate verification
--clean                        Remove empty/null values from results
--no-attributes                Remove XML attributes from results
--read-only                    Restrict to read-only operations
--no-audit                     Disable audit logging for this command
--debug                        Enable debug logging
```

### Audit Trail

All operations are logged to `~/.cisco-axl/audit.jsonl` (JSONL format). Credentials are never logged. Use `--no-audit` to skip.

## Library API

### Setup

```javascript
const axlService = require("cisco-axl");

let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

// With options
let service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0", {
  logging: { level: "info" },
  retry: { retries: 3, retryDelay: 1000 }
});
```

### Logging

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

### Convenience Methods

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

### Operation Discovery

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

### Execute Any Operation

```javascript
const tags = await service.getOperationTags("addRoutePartition");
tags.routePartition.name = "INTERNAL-PT";
tags.routePartition.description = "Internal directory numbers";

const result = await service.executeOperation("addRoutePartition", tags);
console.log("UUID:", result);
```

### Batch Operations

```javascript
const results = await service.executeBatch([
  { operation: "getPhone", tags: { name: "SEP001122334455" } },
  { operation: "getPhone", tags: { name: "SEP556677889900" } },
], 5); // concurrency limit

results.forEach((r) => {
  console.log(r.success ? `${r.operation}: OK` : `${r.operation}: ${r.error.message}`);
});
```

### Error Handling

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

### Retry Configuration

```javascript
let service = new axlService("10.10.20.1", "admin", "pass", "14.0", {
  retry: {
    retries: 3,
    retryDelay: 1000,
    retryOn: (error) => error.message.includes("ECONNRESET")
  }
});
```

### ESM Support

```javascript
// CommonJS
const axlService = require("cisco-axl");

// ESM
import axlService from "cisco-axl";
import { AXLAuthError, AXLOperationError } from "cisco-axl";
```

### json-variables Support

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

## Examples

Check the **examples** folder for different ways to use this library.

Run the integration tests against a CUCM cluster:

```bash
npm run staging
```

## TypeScript Support

```typescript
import axlService from 'cisco-axl';

const service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

const tags = await service.getOperationTags("listRoutePartition");
tags.searchCriteria.name = "%%";
const result = await service.executeOperation("listRoutePartition", tags);
```

See the `examples/typescript` directory for more examples.

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[Buy Me a Coffee](https://www.buymeacoffee.com/automatebldrs)
