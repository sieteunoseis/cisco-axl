# Claude Code Hooks for cisco-axl

[Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) let you enforce guardrails when AI agents use the CLI. The examples below block write operations so Claude can only read from CUCM.

## Block Write Operations

Add this to your `~/.claude/settings.json` (global) or `.claude/settings.json` (project-level) under `hooks.PreToolUse`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | { read -r cmd; if echo \"$cmd\" | grep -qE '^(npx )?cisco-axl (add|update|remove|execute|sql update)'; then echo '{\"decision\":\"block\",\"reason\":\"BLOCKED: cisco-axl write operation. Use --read-only or get explicit user approval.\"}'; fi; }"
          }
        ]
      }
    ]
  }
}
```

### What it blocks

| Command                                        | Blocked | Why                 |
| ---------------------------------------------- | ------- | ------------------- |
| `cisco-axl get Phone SEP...`                   | No      | Read operation      |
| `cisco-axl list Phone --search "name=SEP%"`    | No      | Read operation      |
| `cisco-axl sql query "SELECT ..."`             | No      | Read-only SQL       |
| `cisco-axl operations --filter phone`          | No      | Schema discovery    |
| `cisco-axl describe getPhone`                  | No      | Schema discovery    |
| `cisco-axl add Phone --data '{...}'`           | **Yes** | Creates a resource  |
| `cisco-axl update Phone SEP... --data '{...}'` | **Yes** | Modifies a resource |
| `cisco-axl remove Phone SEP...`                | **Yes** | Deletes a resource  |
| `cisco-axl execute applyPhone --tags '{...}'`  | **Yes** | Executes an action  |
| `cisco-axl sql update "UPDATE ..."`            | **Yes** | Modifies database   |

### Alternative: Use the built-in `--read-only` flag

The CLI has a native `--read-only` flag that restricts to `get`, `list`, `describe`, `operations`, and `sql query`:

```bash
cisco-axl --read-only add Phone --data '{...}'
# Error: Write operations are not allowed in read-only mode
```

You can enforce this globally by adding a hook that appends `--read-only` to every command:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | { read -r cmd; if echo \"$cmd\" | grep -qE '^(npx )?cisco-axl ' && ! echo \"$cmd\" | grep -q '\\-\\-read-only'; then echo '{\"decision\":\"block\",\"reason\":\"BLOCKED: cisco-axl must be run with --read-only. Retry with the flag.\"}'; fi; }"
          }
        ]
      }
    ]
  }
}
```

## Audit Logging

All cisco-axl operations are logged to `~/.cisco-axl/audit.jsonl` by default. This provides a record of every command run by Claude or any other agent.
