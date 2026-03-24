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
cisco-axl get Phone SEP001122334455

# SQL query
cisco-axl sql query "SELECT name, description FROM device WHERE name LIKE 'SEP%'"
```

## Configuration

```bash
cisco-axl config add <name> --host <host> --username <user> --password <pass> --cucm-version <ver> --insecure
cisco-axl config use <name>       # switch active cluster
cisco-axl config list             # list all clusters
cisco-axl config show             # show active cluster (masks passwords)
cisco-axl config remove <name>    # remove a cluster
cisco-axl config test             # test connectivity
```

Auth precedence: CLI flags > env vars (`CUCM_HOST`, `CUCM_USERNAME`, `CUCM_PASSWORD`, `CUCM_VERSION`) > config file.

Config stored at `~/.cisco-axl/config.json`. Supports [ss-cli](https://github.com/sieteunoseis/ss-cli) `<ss:ID:field>` placeholders.

## CLI Commands

| Command | Description |
|---------|-------------|
| `get <type> <identifier>` | Get a single item |
| `list <type>` | List items with search, pagination, returned tags |
| `add <type>` | Add an item (inline JSON, template, or bulk CSV) |
| `update <type> <identifier>` | Update an item |
| `remove <type> <identifier>` | Remove an item |
| `sql query/update` | Execute SQL against CUCM |
| `execute <operation>` | Run any raw AXL operation |
| `operations` | List available operations |
| `describe <operation>` | Show tag schema for an operation |
| `doctor` | Check AXL connectivity and health |

See [full CLI reference](docs/cli.md) for bulk CSV, command chaining, piping with `--stdin`, and operation discovery.

## Global Flags

| Flag | Description |
|------|-------------|
| `--format table\|json\|toon\|csv` | Output format (default: table) |
| `--insecure` | Skip TLS certificate verification |
| `--clean` | Remove empty/null values from results |
| `--no-attributes` | Remove XML attributes from results |
| `--read-only` | Restrict to read-only operations |
| `--no-audit` | Disable audit logging for this command |
| `--debug` | Enable debug logging |

## Library API

```javascript
const axlService = require("cisco-axl");
const service = new axlService("10.10.20.1", "administrator", "ciscopsdt", "14.0");

// Get, list, add, update, remove
await service.getItem("Phone", "SEP001122334455");
await service.listItems("Phone", { name: "SEP%" });
await service.addItem("RoutePartition", { name: "NEW-PT", description: "New" });

// SQL
await service.executeSqlQuery("SELECT name FROM routepartition");

// Any AXL operation
const tags = await service.getOperationTags("addRoutePartition");
tags.routePartition.name = "INTERNAL-PT";
await service.executeOperation("addRoutePartition", tags);
```

See [full API documentation](docs/api.md) for all methods, error handling, batch operations, TypeScript, retry config, and logging.

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
