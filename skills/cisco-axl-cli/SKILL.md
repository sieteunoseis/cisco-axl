---
name: cisco-axl-cli
description: Use when managing Cisco CUCM via the cisco-axl CLI — phones, lines, route patterns, partitions, calling search spaces, SIP profiles, and any AXL operation. Covers CRUD operations, SQL queries, operation discovery, bulk provisioning from CSV, and raw AXL execute commands.
---

# Cisco AXL CLI

A CLI for Cisco Unified Communications Manager (CUCM) Administrative XML (AXL) operations.

## Setup

Configure a CUCM cluster:

```bash
cisco-axl config add <name> --host <hostname> --username <user> --password <pass> --cucm-version <ver> --insecure
```

Valid versions: 11.0, 11.5, 12.0, 12.5, 14.0, 15.0. Use `--insecure` for self-signed certificates (common in CUCM).

Or use environment variables:

```bash
export CUCM_HOST=10.0.0.1 CUCM_USERNAME=admin CUCM_PASSWORD=secret CUCM_VERSION=14.0
```

Test the connection:

```bash
cisco-axl config test
```

## Common Operations

### Get a single item

```bash
cisco-axl get Phone SEP001122334455
cisco-axl get Line 1001
cisco-axl get RoutePartition PT_INTERNAL
cisco-axl get Phone SEP001122334455 --returned-tags "name,model,description"
```

### List items with search

```bash
cisco-axl list Phone --search "name=SEP%"
cisco-axl list Line --search "pattern=1%"
cisco-axl list Css --search "name=CSS_%"
cisco-axl list Phone --search "name=SEP%" --returned-tags "name,description" --format toon
cisco-axl list Phone --search "name=SEP%" --auto-page --max-results 5000
```

### Add an item

```bash
cisco-axl add RoutePartition --data '{"name":"PT_INTERNAL","description":"Internal partition"}'
```

### Update an item

```bash
cisco-axl update Phone SEP001122334455 --data '{"description":"Updated description"}'
```

### Remove an item

```bash
cisco-axl remove RoutePartition PT_INTERNAL
```

### SQL queries

```bash
cisco-axl sql query "SELECT name, description FROM device WHERE name LIKE 'SEP%'"
cisco-axl sql update "UPDATE device SET description='test' WHERE name='SEP001122334455'"
```

## Discovering Operations

This is the CLI's most powerful feature. Discover and use ANY AXL operation dynamically — no static command definitions.

### Step 1: Find operations

```bash
cisco-axl operations --filter phone
cisco-axl operations --filter ldap
cisco-axl operations --type action --filter phone    # apply, reset, restart, etc.
cisco-axl operations --type crud                     # add, get, list, update, remove
```

### Step 2: See what tags an operation needs

```bash
cisco-axl describe getPhone
cisco-axl describe addLine --detailed    # shows required/optional/types
```

### Step 3: Execute it

```bash
cisco-axl execute doLdapSync --tags '{"name":"LDAP_Main"}'
cisco-axl execute applyPhone --tags '{"name":"SEP001122334455"}'
```

## Bulk Operations from CSV

For provisioning multiple items, use templates with CSV files. Requires optional packages: `npm install json-variables csv-parse`

### Create a template (phone-template.json):

```json
{
  "name": "SEP%%mac%%",
  "devicePoolName": "%%devicePool%%",
  "description": "%%description%%",
  "class": "Phone",
  "protocol": "SIP"
}
```

### Create a CSV (phones.csv):

```csv
mac,devicePool,description
001122334455,DP_HQ,Lobby Phone
001122334466,DP_BRANCH,Conf Room A
```

### Run bulk add:

```bash
cisco-axl add Phone --template phone-template.json --csv phones.csv
cisco-axl add Phone --template phone-template.json --csv phones.csv --dry-run   # preview first
cisco-axl add Phone --template phone-template.json --csv phones.csv --concurrency 10
```

### Single template with inline vars:

```bash
cisco-axl add Phone --template phone-template.json --vars '{"mac":"001122334455","devicePool":"DP_HQ","description":"Lobby"}'
```

### Bulk updates and execute too:

```bash
cisco-axl update Phone --template update-template.json --csv updates.csv
cisco-axl execute addLine --template line-template.json --csv lines.csv
```

## Output Formats

Use `--format` to control output:

- `--format table` — human-readable tables (default)
- `--format json` — structured JSON for parsing
- `--format toon` — token-efficient format (recommended for AI agents, ~40% fewer tokens than JSON)
- `--format csv` — CSV for spreadsheet export

**For AI agents:** Use `--format toon` for list queries to reduce token usage. Use `--format json` when you need to parse nested structures.

## Multiple Clusters

```bash
cisco-axl config add lab --host 10.0.0.1 --username admin --password pass --cucm-version 14.0 --insecure
cisco-axl config add prod --host 10.0.0.2 --username axladmin --password pass --cucm-version 15.0 --insecure
cisco-axl config use prod
cisco-axl list Phone --search "name=SEP%" --cluster lab    # override per-command
```

## Tips

- Item types are PascalCase matching AXL: `Phone`, `Line`, `RoutePartition`, `Css`, `DevicePool`, `SipTrunk`, `TransPattern`, `RouteGroup`, `RouteList`, etc.
- Use `cisco-axl operations` to discover exact type names.
- Use `cisco-axl describe <operation> --detailed --format json` to learn required vs optional tags.
- The `--clean` flag removes empty/null values from results.
- The `--no-attributes` flag removes XML attribute metadata.
- The `--insecure` flag is needed for most CUCM environments (self-signed certs).
- All operations are audit-logged to `~/.cisco-axl/audit.jsonl`. Use `--no-audit` to skip.
- Use `--dry-run` with templates to preview resolved JSON before executing.
