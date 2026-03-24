# CLI Reference

The CLI provides full AXL access from the command line — CRUD operations, SQL queries, operation discovery, bulk provisioning from CSV, and a raw execute escape hatch for any AXL operation.

## Commands

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
| `doctor` | Check AXL connectivity and configuration health |

## Operation Discovery

```bash
# Discover available operations
cisco-axl operations --filter phone
cisco-axl operations --type action --filter phone

# Describe what tags an operation needs
cisco-axl describe getPhone --detailed

# Execute any AXL operation
cisco-axl execute doLdapSync --tags '{"name":"LDAP_Main"}'
```

## Bulk Operations from CSV

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

## Command Chaining

Shell `&&` chains commands sequentially — each waits for the previous to complete, and the chain stops on the first failure:

```bash
# Create a partition, CSS, and line in order
cisco-axl add RoutePartition --data '{"name":"PT_INTERNAL","description":"Internal"}' && \
cisco-axl add Css --data '{"name":"CSS_INTERNAL","members":{"member":{"routePartitionName":"PT_INTERNAL","index":"1"}}}' && \
cisco-axl add Line --data '{"pattern":"1000","routePartitionName":"PT_INTERNAL"}'
```

## Piping with --stdin

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
