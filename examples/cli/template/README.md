# CLI Template & Bulk Operations Example

This example shows how to use the `cisco-axl` CLI to provision and update devices in bulk using JSON templates and CSV files.

Templates use [json-variables](https://codsen.com/os/json-variables) placeholder syntax (`%%var%%`). CSV column headers map to template variables.

## Prerequisites

```bash
# Install optional template dependencies
npm install json-variables csv-parse

# Configure a cluster
cisco-axl config add mylab --host 10.0.0.1 --username admin --password secret --cucm-version 14.0 --insecure
```

## Files

| File | Description |
|------|-------------|
| `phone-template.json` | Template for adding physical phones (Cisco 8845) |
| `jabber-template.json` | Template for adding Jabber soft clients |
| `phones.csv` | CSV data for bulk phone provisioning |
| `jabber-phones.csv` | CSV data for bulk Jabber provisioning |
| `update-template.json` | Template for bulk description updates |
| `updates.csv` | CSV data for bulk updates (includes `name` column as identifier) |

## Template Syntax

Templates are JSON files with `%%variableName%%` placeholders. Static values stay as-is.

```json
{
  "name": "SEP%%mac%%",
  "description": "%%lastName%%,%%firstName%% %%shortExt%%",
  "devicePoolName": "%%devicePool%%",
  "protocol": "SIP"
}
```

CSV columns map to the variable names:

```csv
mac,firstName,lastName,shortExt,devicePool
001122334455,John,Smith,1-001,DP_HQ
```

Result for row 1:

```json
{
  "name": "SEP001122334455",
  "description": "Smith,John 1-001",
  "devicePoolName": "DP_HQ",
  "protocol": "SIP"
}
```

## Usage

### Add Physical Phones in Bulk

```bash
# Preview first (dry run)
cisco-axl add Phone --template phone-template.json --csv phones.csv --dry-run

# Execute
cisco-axl add Phone --template phone-template.json --csv phones.csv

# With concurrency control
cisco-axl add Phone --template phone-template.json --csv phones.csv --concurrency 3
```

### Add Jabber Phones in Bulk

```bash
cisco-axl add Phone --template jabber-template.json --csv jabber-phones.csv --dry-run
cisco-axl add Phone --template jabber-template.json --csv jabber-phones.csv
```

### Add a Single Phone from Template

```bash
cisco-axl add Phone --template phone-template.json --vars '{"mac":"001122334455","userid":"jsmith","firstName":"John","lastName":"Smith","extension":"5551001","shortExt":"1-001","devicePool":"DP_HQ","css":"CSS_Standard","routePartition":"OnNet"}'
```

### Bulk Update Descriptions

```bash
# The CSV must include a 'name' or 'uuid' column to identify each device
cisco-axl update Phone --template update-template.json --csv updates.csv --dry-run
cisco-axl update Phone --template update-template.json --csv updates.csv
```

### Use with Different Clusters

```bash
# Dry run against lab
cisco-axl add Phone --template phone-template.json --csv phones.csv --dry-run --cluster lab

# Execute against production
cisco-axl add Phone --template phone-template.json --csv phones.csv --cluster prod
```

## Creating a Template from an Existing Phone

Use `get` to export a phone's config, then replace unique values with `%%var%%` placeholders:

```bash
# Export an existing phone as JSON
cisco-axl get Phone SEP001122334455 --clean --no-attributes --format json > my-phone.json

# Or export specific fields only
cisco-axl get Phone SEP001122334455 --returned-tags "name,description,product,model,class,protocol,callingSearchSpaceName,devicePoolName,commonPhoneConfigName,securityProfileName,sipProfileName,ownerUserName,lines" --clean --no-attributes --format json > my-phone.json
```

Then edit `my-phone.json` and replace the unique values with placeholders:

```
"name": "SEP001122334455"       →  "name": "SEP%%mac%%"
"description": "Smith,John"     →  "description": "%%lastName%%,%%firstName%% %%shortExt%%"
"devicePoolName": "DP_HQ"       →  "devicePoolName": "%%devicePool%%"
"ownerUserName": "jsmith"       →  "ownerUserName": "%%userid%%"
"pattern": "5551001"            →  "pattern": "%%extension%%"
```

Keep static values unchanged (product, model, protocol, security profile, etc). Save as your template and pair with a CSV.

## Tips

- Always `--dry-run` first to verify the resolved JSON looks correct
- Use `cisco-axl describe addPhone --detailed` to see all available fields and which are required
- Use `cisco-axl get Phone <name> --format json` to export an existing device config as a starting point for your template
- The `shortExt` field is a convention for the formatted short extension (e.g., `8-0368` from `5034180368`) — format it in the CSV however your org prefers
- Static values in the template (product, model, protocol, security profile) are the same for every device and don't need CSV columns
