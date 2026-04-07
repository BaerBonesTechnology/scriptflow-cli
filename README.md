# Scriptflow CLI

A command-line workflow automation tool that lets you create, manage, and run reusable command sequences across Bash, Zsh, PowerShell, and CMD.

## Installation

```bash
npm install -g scriptflow-cli
```

This makes the `flow` command available globally.

## Quick Start

```bash
# 1. Initialize — pick your shell and storage location
flow init

# 2. Create a flow
flow create
#    Flow name: deploy
#    Path: /home/user/my-project
#    Commands: git add ., git commit -m "{message}", git push origin {branch==main},

# 3. Run it
flow run deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `flow init` | First-time setup — choose terminal profile and flow directory |
| `flow create` | Interactively create a new flow |
| `flow list` | List all saved flows |
| `flow run <flowName>` | Run a flow by name |
| `flow edit <flowName>` | Open a flow script in your editor |
| `flow delete <flowName>` | Delete a flow |
| `flow clear` | Delete all flows |
| `flow reinit` | Re-initialize (move or delete existing flows) |
| `flow update` | Update CLI and regenerate flow scripts |
| `flow default` | Reset config to defaults |
| `flow config` | View current configuration |
| `flow news` | View version announcements |
| `flow help` | Show help |

## Flow Parameters

When creating a flow, you can use parameter placeholders in your commands. These are resolved at runtime — either from CLI flags or interactive prompts.

### Syntax

| Syntax | Type | Behavior when not provided |
|--------|------|---------------------------|
| `{name}` | **Required** | User is prompted to enter a value |
| `?{name}` | **Nullable** | Silently removed (replaced with empty string) |
| `{name==default}` | **Optional** | Uses the default value |

### Example

Create a flow with parameters:

```
Enter the commands to run:
git add ., git commit -m "{message}", git push ?{remote} {branch==main},
```

Run it — parameters are prompted interactively:

```bash
flow run deploy
# > This flow requires parameter(s): {message}
# > Enter value for {message}: fix typo
# ?{remote} is removed, {branch==main} defaults to "main"
```

Or pass values via flags to skip prompts:

```bash
flow run deploy --message "fix typo" --remote origin --branch dev
```

You can mix both — pass some flags and get prompted for the rest.

## Editing Flows

```bash
flow edit <flowName>
```

By default this opens in VS Code (`code`). To change the editor:

```bash
# Set editor by command name (must be in PATH)
flow edit my-flow --openCommand subl

# Set editor by absolute path
flow edit my-flow --path "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl"
```

Your choice is saved for future use.

## Configuration

Scriptflow stores its configuration in `~/.scriptflow/config.json`. This includes:

- **terminalProfile** — `bash`, `zsh`, `powershell`, or `cmd`
- **flowDir** — where flow data is stored (default: `~/.flows`)
- **defaultTextEditorCommand** — editor command for `flow edit`

View the current config with:

```bash
flow config
```

## Announcements

Stay up to date with what's new:

```bash
# Interactive version picker
flow news

# Specific version
flow news --versionChoice 1.1.0

# All announcements
flow news --versionChoice ALL
```

## What's New in v1.1.0

- **Flow parameters** — Use `{param}`, `?{param}`, and `{param==default}` syntax for dynamic flows
- **Interactive flow execution** — Flows now support stdin pass-through for commands that expect user input
- **Config moved to home directory** — No longer writes to the installed package; lives in `~/.scriptflow/`
- **Improved version comparison** — Numeric comparison instead of string-based
- **Bug fixes** — Fixed editor command, ESM compatibility, shell injection hardening, and more

## Contributing

Contributions, bug reports, and feature suggestions are welcome. Visit the [GitHub repository](https://github.com/Baer-Bones-Technologies/scriptflow-cli) for more details.

## License

MIT — see [LICENSE](LICENSE) for details.