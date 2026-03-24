# Cisco AXL Library & CLI

[![npm version](https://img.shields.io/npm/v/cisco-axl.svg)](https://www.npmjs.com/package/cisco-axl)
[![CI](https://github.com/sieteunoseis/cisco-axl/actions/workflows/ci.yml/badge.svg)](https://github.com/sieteunoseis/cisco-axl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/cisco-axl.svg)](https://nodejs.org)
[![Skills](https://img.shields.io/badge/skills.sh-cisco--axl--cli-blue)](https://skills.sh/sieteunoseis/cisco-axl)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

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
npx skills add sieteunoseis/cisco-axl
```

## Requirements

If you are using self-signed certificates on Cisco VOS products you may need to disable TLS verification, or use the `--insecure` CLI flag.

Supported CUCM versions: `11.0`, `11.5`, `12.0`, `12.5`, `14.0`, `15.0`

## Quick Start

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
```

## Configuration

```bash
# Multiple clusters
cisco-axl config add lab --host 10.0.0.1 --username admin --password secret --cucm-version 14.0 --insecure
cisco-axl config add prod --host 10.0.0.2 --username axladmin --password secret --cucm-version 15.0 --insecure
cisco-axl config use prod
cisco-axl config list
cisco-axl config show
cisco-axl config remove lab
cisco-axl config test

# Per-command cluster override
cisco-axl list Phone --search "name=SEP%" --cluster lab

# Environment variables (CI/CD, AI agents)
export CUCM_HOST=10.0.0.1 CUCM_USERNAME=admin CUCM_PASSWORD=secret CUCM_VERSION=14.0
```

Config stored at `~/.cisco-axl/config.json`. Supports optional [Secret Server](https://github.com/sieteunoseis/ss-cli) integration via `<ss:ID:field>` placeholders.

## CLI Commands

| Command                                | Description                                                         |
| -------------------------------------- | ------------------------------------------------------------------- |
| `config add/use/list/show/remove/test` | Manage multi-cluster configurations                                 |
| `get <type> <identifier>`              | Get a single item                                                   |
| `list <type>`                          | List items with search, pagination, returned tags                   |
| `add <type>`                           | Add an item (inline JSON, template, or bulk CSV)                    |
| `update <type> <identifier>`           | Update an item                                                      |
| `remove <type> <identifier>`           | Remove an item                                                      |
| `sql query/update`                     | Execute SQL against CUCM                                            |
| `execute <operation>`                  | Run any raw AXL operation                                           |
| `operations`                           | List available operations with `--filter` and `--type crud\|action` |
| `describe <operation>`                 | Show tag schema with `--detailed` for required/optional/type info   |
| `doctor`                               | Check AXL connectivity and configuration health                     |

### Operation Discovery

```bash
# Discover available operations
cisco-axl operations --filter phone
cisco-axl operations --type action --filter phone

# Describe what tags an operation needs
cisco-axl describe getPhone --detailed

# Execute any AXL operation
cisco-axl execute doLdapSync --tags '{"name":"LDAP_Main"}'
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

### Command Chaining

Shell `&&` chains commands sequentially — each waits for the previous to complete, and the chain stops on the first failure:

```bash
# Create a partition, CSS, and line in order
cisco-axl add RoutePartition --data '{"name":"PT_INTERNAL","description":"Internal"}' && \
cisco-axl add Css --data '{"name":"CSS_INTERNAL","members":{"member":{"routePartitionName":"PT_INTERNAL","index":"1"}}}' && \
cisco-axl add Line --data '{"pattern":"1000","routePartitionName":"PT_INTERNAL"}'
```

### Piping with --stdin

Use `--stdin` to pipe JSON between commands or from other tools like `jq`:

```bash
# Get a phone's config, modify it with jq, update it
cisco-axl get Phone SEP001122334455 --format json | \
  jq '.description = "Updated via pipe"' | \
  cisco-axl update Phone SEP001122334455 --stdin

# Pipe JSON from a file
cat phone-config.json | cisco-axl add Phone --stdin

# Discover tags, fill them in, execute
cisco-axl describe applyPhone --format json | \
  jq '.name = "SEP001122334455"' | \
  cisco-axl execute applyPhone --stdin
```

The `--stdin` flag is available on `add`, `update`, and `execute`. It is mutually exclusive with `--data`/`--tags` and `--template`.

## Global Flags

```
--format table|json|toon|csv   Output format (default: table)
--insecure                     Skip TLS certificate verification
--clean                        Remove empty/null values from results
--no-attributes                Remove XML attributes from results
--read-only                    Restrict to read-only operations
--no-audit                     Disable audit logging for this command
--debug                        Enable debug logging
```

## Output Formats

```bash
cisco-axl list Phone --search "name=SEP%" --format table  # default, human-readable
cisco-axl list Phone --search "name=SEP%" --format json   # structured JSON
cisco-axl list Phone --search "name=SEP%" --format toon   # token-efficient for AI agents
cisco-axl list Phone --search "name=SEP%" --format csv    # spreadsheet export
```

## Audit Trail

All operations are logged to `~/.cisco-axl/audit.jsonl` (JSONL format). Credentials are never logged. Use `--no-audit` to skip.

## Library API

### Setup

```javascript
const axlService = require("cisco-axl");

let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0",
);

// With options
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0",
  {
    logging: { level: "info" },
    retry: { retries: 3, retryDelay: 1000 },
  },
);
```

### ESM / TypeScript

```javascript
// CommonJS
const axlService = require("cisco-axl");

// ESM
import axlService from "cisco-axl";
import { AXLAuthError, AXLOperationError } from "cisco-axl";
```

```typescript
import axlService from "cisco-axl";

const service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0",
);

const tags = await service.getOperationTags("listRoutePartition");
tags.searchCriteria.name = "%%";
const result = await service.executeOperation("listRoutePartition", tags);
```

See the `examples/typescript` directory for more examples.

### Logging

```javascript
// Via environment variable
// DEBUG=true

// Via constructor
let service = new axlService(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "14.0",
  {
    logging: {
      level: "info", // "error" | "warn" | "info" | "debug"
      handler: (level, message, data) => {
        myLogger[level](message, data);
      },
    },
  },
);

// Change at runtime
service.setLogLevel("debug");
```

### Convenience Methods

```javascript
// Get a single item by name or UUID
await service.getItem("Phone", "SEP001122334455");
await service.getItem("Phone", { uuid: "abc-123" });

// List items with search criteria and returned tags
await service.listItems("RoutePartition"); // all partitions
await service.listItems("Phone", { name: "SEP%" }, { name: "", model: "" });

// Add, update, remove
await service.addItem("RoutePartition", { name: "NEW-PT", description: "New" });
await service.updateItem("Phone", "SEP001122334455", {
  description: "Updated",
});
await service.removeItem("RoutePartition", "NEW-PT");

// SQL
const rows = await service.executeSqlQuery("SELECT name FROM routepartition");
await service.executeSqlUpdate(
  "UPDATE routepartition SET description='test' WHERE name='NEW-PT'",
);
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
console.log(detailed.routePartition.required); // true
console.log(detailed.routePartition.children.name.type); // "string"
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
const results = await service.executeBatch(
  [
    { operation: "getPhone", tags: { name: "SEP001122334455" } },
    { operation: "getPhone", tags: { name: "SEP556677889900" } },
  ],
  5,
); // concurrency limit

results.forEach((r) => {
  console.log(
    r.success ? `${r.operation}: OK` : `${r.operation}: ${r.error.message}`,
  );
});
```

### Error Handling

```javascript
const {
  AXLAuthError,
  AXLNotFoundError,
  AXLOperationError,
  AXLValidationError,
} = require("cisco-axl");

try {
  await service.executeOperation("getPhone", { name: "INVALID" });
} catch (error) {
  if (error instanceof AXLAuthError) console.log("Bad credentials");
  else if (error instanceof AXLNotFoundError)
    console.log("Operation not found:", error.operation);
  else if (error instanceof AXLOperationError)
    console.log("SOAP fault:", error.message);
  else if (error instanceof AXLValidationError)
    console.log("Invalid input:", error.message);
}
```

### Retry Configuration

```javascript
let service = new axlService("10.10.20.1", "admin", "pass", "14.0", {
  retry: {
    retries: 3,
    retryDelay: 1000,
    retryOn: (error) => error.message.includes("ECONNRESET"),
  },
});
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

### Methods Reference

#### Core

| Method                                             | Description                                        |
| -------------------------------------------------- | -------------------------------------------------- |
| `new axlService(host, user, pass, version, opts?)` | Constructor                                        |
| `testAuthentication()`                             | Test credentials against AXL endpoint              |
| `returnOperations(filter?)`                        | List available operations                          |
| `getOperationTags(operation)`                      | Get tag schema for an operation                    |
| `getOperationTagsDetailed(operation)`              | Get detailed tag metadata (required/nillable/type) |
| `executeOperation(operation, tags, opts?)`         | Execute any AXL operation                          |
| `executeBatch(operations[], concurrency?)`         | Parallel batch execution                           |
| `setLogLevel(level)`                               | Change log level at runtime                        |

#### Convenience

| Method                                           | Description                     |
| ------------------------------------------------ | ------------------------------- |
| `getItem(type, identifier, opts?)`               | Get single item by name or UUID |
| `listItems(type, search?, returnedTags?, opts?)` | List items with filtering       |
| `addItem(type, data, opts?)`                     | Add a new item                  |
| `updateItem(type, identifier, updates, opts?)`   | Update an existing item         |
| `removeItem(type, identifier, opts?)`            | Remove an item                  |
| `executeSqlQuery(sql)`                           | Run a SQL SELECT query          |
| `executeSqlUpdate(sql)`                          | Run a SQL INSERT/UPDATE/DELETE  |

### Examples

Check the **examples** folder for different ways to use this library.

Run the integration tests against a CUCM cluster:

```bash
npm run staging
```

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
