# CLAUDE.md

This file provides guidance to Claude Code when working with the Hopx CLI (Bun version).

## Overview

This is the **Hopx CLI (Bun)** - the official TypeScript/Bun-based command-line interface for Hopx.ai cloud sandboxes. This CLI is a rewrite of the original Python CLI (`../cli/`), built with Bun for faster startup and single-binary distribution.

**Version**: 0.1.0
**Runtime**: Bun 1.0+ (Node.js 18+ fallback)
**License**: MIT

## Architecture

### Directory Structure

```
cli-bun/
├── src/
│   ├── index.ts              # Entry point with Commander setup
│   ├── commands/             # All 15 command groups
│   │   ├── auth.ts           # Authentication management
│   │   ├── sandbox.ts        # Sandbox lifecycle (alias: sb)
│   │   ├── run.ts            # Code execution
│   │   ├── files.ts          # File operations (alias: f)
│   │   ├── cmd.ts            # Shell commands
│   │   ├── env.ts            # Environment variables
│   │   ├── terminal.ts       # Interactive terminal (alias: term)
│   │   ├── template.ts       # Template management (alias: tpl)
│   │   ├── config.ts         # Configuration management
│   │   ├── system.ts         # Health and metrics
│   │   ├── init.ts           # First-run wizard
│   │   ├── org.ts            # Organization settings
│   │   ├── profile.ts        # User profile
│   │   ├── members.ts        # Organization members
│   │   ├── billing.ts        # Billing information
│   │   └── usage.ts          # Usage statistics
│   ├── lib/
│   │   ├── config.ts         # Configuration management
│   │   ├── errors.ts         # Error handling and exit codes
│   │   ├── auth/             # Authentication module
│   │   │   ├── credentials.ts  # Keyring/file credential storage
│   │   │   ├── oauth.ts        # Browser OAuth flow
│   │   │   └── token.ts        # Token management
│   │   └── output/           # Output formatting
│   │       ├── table.ts        # Table formatter
│   │       ├── json.ts         # JSON formatter
│   │       ├── progress.ts     # Spinners and progress bars
│   │       └── index.ts        # Unified output interface
│   └── types/                # TypeScript types
├── bin/
│   └── hopx.ts               # Binary entry point
├── tests/                    # Unit tests
├── scripts/
│   ├── build-binaries.ts     # Build standalone binaries
│   └── install.sh            # Installation script
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

### Key Dependencies

- **@hopx-ai/sdk**: Official Hopx SDK for API communication
- **commander**: CLI argument parsing
- **chalk**: Terminal colors
- **cli-table3**: Table formatting
- **ora**: Spinners
- **yaml**: Config file parsing
- **keytar**: Secure credential storage (optional, native)
- **open**: Open URLs in browser

### SDK Integration

The CLI imports `@hopx-ai/sdk` directly:

```typescript
import { Sandbox } from "@hopx-ai/sdk";

const sandbox = await Sandbox.create({ template: "python", apiKey });
const result = await sandbox.runCode("print('hello')");
await sandbox.kill();
```

## Development Commands

```bash
# Install dependencies
bun install

# Run in development (with watch)
bun run dev

# Type check
bun run typecheck

# Run tests
bun test

# Build for distribution
bun run build

# Build standalone binaries
bun run build:bin
bun run build:bin --target=darwin-arm64
```

## Error Handling

### Exit Codes

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | Success | Operation completed |
| 1 | GeneralError | Unspecified error |
| 2 | ValidationError | Invalid input |
| 3 | AuthenticationError | Auth failed |
| 4 | NotFoundError | Resource not found |
| 5 | TimeoutError | Operation timed out |
| 6 | NetworkError | Network unreachable |
| 7 | RateLimitError | Rate limited |
| 130 | Interrupted | Ctrl+C |

### Error Handling Pattern

```typescript
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";

commandName
  .command("action")
  .action(
    withErrorHandler(async (options) => {
      // SDK errors are automatically mapped to exit codes
      const sandbox = await Sandbox.create({ template: "python" });

      // Throw CLI errors for custom handling
      if (!options.required) {
        throw new CLIError(
          "Missing required option",
          ExitCode.ValidationError,
          "Use --required to specify"
        );
      }
    })
  );
```

## Configuration

### File Locations

- Config: `~/.hopx/config.yaml`
- Credentials: System keyring or `~/.hopx/credentials.yaml`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOPX_API_KEY` | API key | - |
| `HOPX_BASE_URL` | API URL | https://api.hopx.dev |
| `HOPX_PROFILE` | Config profile | default |
| `HOPX_DEFAULT_TEMPLATE` | Default template | python |
| `HOPX_DEFAULT_TIMEOUT` | Default timeout | 300 |
| `HOPX_CLI_OUTPUT` | Output format | table |

### Config Precedence

1. CLI flags (`--api-key`, `--output`)
2. Environment variables
3. Config file values
4. Default values

## Output Formatting

### Three Output Modes

```typescript
import { output, outputList } from "../lib/output/index.js";

// Auto-selects based on --output flag
output(data, { keyValueTitle: "Details" });

outputList(items, {
  title: "Items",
  columns: [
    { key: "id", header: "ID" },
    { key: "status", header: "Status", format: statusFormat },
    { key: "created", header: "Created", format: relativeDate },
  ],
});
```

## Authentication

### Credential Storage

1. **Primary**: System keyring via `keytar`
   - macOS: Keychain
   - Linux: libsecret
   - Windows: Credential Manager

2. **Fallback**: Encrypted file `~/.hopx/credentials.yaml` (mode 0600)

### OAuth Flow

```typescript
import { startOAuthLogin } from "../lib/auth/oauth.js";

// Opens browser, starts local callback server
const result = await startOAuthLogin();
// Returns: { accessToken, refreshToken?, apiKey? }
```

## Common Patterns

### Requiring API Key

```typescript
import { requireApiKey } from "../lib/auth/token.js";

const apiKey = await requireApiKey(); // Throws if not configured
```

### Sandbox Operations

```typescript
import { Sandbox } from "@hopx-ai/sdk";

// Create new
const sandbox = await Sandbox.create({ template: "python", apiKey });

// Connect to existing
const sandbox = await Sandbox.connect(sandboxId, { apiKey });
```

### Confirmation Prompts

```typescript
import { createInterface } from "readline";

if (!options.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(chalk.yellow("Continue? (y/N): "), resolve);
  });
  rl.close();
  if (answer.toLowerCase() !== "y") return;
}
```

## Building Standalone Binaries

```bash
# Build all platforms
bun run build:bin

# Build specific platform
bun run build:bin --target=darwin-arm64

# Outputs to dist/bin/
# - hopx-darwin-arm64
# - hopx-darwin-x64
# - hopx-linux-x64
# - hopx-linux-arm64
# - hopx-windows-x64.exe
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/config.test.ts

# Watch mode
bun test --watch
```

## Differences from Python CLI

| Feature | Python CLI | Bun CLI |
|---------|-----------|---------|
| Package | `hopx-cli` (PyPI) | `@hopx-ai/cli` (npm) |
| Runtime | Python 3.12+ | Bun 1.0+ / Node 18+ |
| Framework | Typer/Click | Commander.js |
| Output | Rich | chalk + cli-table3 |
| Credentials | keyring | keytar |
| Distribution | pip | npm + binaries |

## Migration from Python CLI

```bash
# Uninstall Python CLI
pip uninstall hopx-cli

# Install Bun CLI
npm install -g @hopx-ai/cli
# or download binary from releases

# Config files are compatible
# ~/.hopx/config.yaml works with both

# Credentials may need re-authentication
hopx auth login
```
