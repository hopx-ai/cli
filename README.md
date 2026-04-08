# Hopx CLI

Official command-line interface for [Hopx.ai](https://hopx.ai) cloud sandboxes.

## Installation

### npm / bun

```bash
npm install -g @hopx-ai/cli
# or
bun install -g @hopx-ai/cli
```

### Standalone Binary (recommended)

Single-binary install, no Node.js or Bun runtime required. The
installer auto-detects your platform, downloads the matching binary,
verifies its SHA256 checksum, and adds it to your `PATH`.

#### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/hopx-ai/cli/main/install.sh | bash
```

#### Windows

There are three ways to install on Windows, depending on your shell.

**WSL, Git Bash, or MSYS2 (easiest)** — the same installer works:

```bash
curl -fsSL https://raw.githubusercontent.com/hopx-ai/cli/main/install.sh | bash
```

In Git Bash this installs the real Windows `.exe` to
`C:\Users\<you>\.hopx\bin\hopx.exe`. In WSL you get the Linux binary.

**Native PowerShell** — run the following in an elevated or normal
PowerShell prompt:

```powershell
$ErrorActionPreference = "Stop"
$version = "cli-v0.2.0"
$dir     = "$env:USERPROFILE\.hopx\bin"
$url     = "https://github.com/hopx-ai/cli/releases/download/$version/hopx-windows-x64.exe"
$sumsUrl = "https://github.com/hopx-ai/cli/releases/download/$version/SHA256SUMS"

New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest -Uri $url -OutFile "$dir\hopx.exe"

# Verify SHA256 checksum
$expected = ((Invoke-WebRequest $sumsUrl).Content -split "`n" |
  Select-String "hopx-windows-x64.exe").ToString().Split()[0]
$actual = (Get-FileHash "$dir\hopx.exe" -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw "checksum mismatch" }

# Add to user PATH (persistent)
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$dir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$dir", "User")
}

Write-Host "Installed. Open a new terminal and run: hopx --version"
```

**Manual download** — grab `hopx-windows-x64.exe` from the
[latest release](https://github.com/hopx-ai/cli/releases/latest), rename
it to `hopx.exe`, place it anywhere on your `PATH` (e.g.
`C:\Users\<you>\.hopx\bin\`), and update your user PATH environment
variable.

> A one-liner `install.ps1` (`irm https://... | iex`) is planned for a
> future release. Until then the PowerShell snippet above is the
> recommended native-Windows path.

## Migrating from the Python CLI (`hopx-cli` on PyPI)

If you previously installed the Python CLI via `pip`, `pipx`, or `uv`:

1. Install the new binary with the curl command above.
2. Uninstall the Python package: `pipx uninstall hopx-cli` (or
   `uv tool uninstall hopx-cli`, or `pip uninstall hopx-cli`).
3. Your `~/.hopx/config.yaml` is preserved and works unchanged.
4. Credentials are **automatically migrated** from the OS keyring on
   first run — you do not need to re-authenticate. Set
   `HOPX_NO_MIGRATE=1` to opt out.

## Quick Start

```bash
# First-time setup
hopx init

# Create a sandbox
hopx sandbox create --template python

# Run code
hopx run 'print("Hello from Hopx!")' --sandbox <id>

# List sandboxes
hopx sandbox list

# Kill sandbox
hopx sandbox kill <id>
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `init` | - | First-run setup wizard |
| `auth` | - | Authentication management |
| `sandbox` | `sb` | Sandbox lifecycle |
| `run` | - | Execute code |
| `files` | `f` | File operations |
| `cmd` | - | Shell commands |
| `env` | - | Environment variables |
| `terminal` | `term` | Interactive terminal |
| `template` | `tpl` | Template management |
| `config` | - | Configuration |
| `system` | - | Health and metrics |
| `org` | - | Organization settings |
| `profile` | - | User profile |
| `members` | - | Organization members |
| `billing` | - | Billing information |
| `usage` | - | Usage statistics |

## Authentication

```bash
# Browser-based login
hopx auth login

# Use API key directly
hopx auth login --api-key hopx_live_xxx

# Check status
hopx auth status

# Logout
hopx auth logout
```

## Sandbox Operations

```bash
# Create sandbox
hopx sandbox create --template python
hopx sandbox create -t nodejs --timeout 600

# List sandboxes
hopx sandbox list
hopx sandbox list --status running

# Get sandbox info
hopx sandbox info <id>

# Pause/resume
hopx sandbox pause <id>
hopx sandbox resume <id>

# Kill sandbox
hopx sandbox kill <id>
hopx sandbox kill <id> --yes  # Skip confirmation
```

## Code Execution

```bash
# Run inline code
hopx run 'print("hello")' --sandbox <id>
hopx run 'console.log("hello")' -s <id> -l javascript

# Run file
hopx run script.py --sandbox <id>

# Create sandbox, run, and cleanup
hopx run 'print("hello")' --template python

# Keep sandbox after execution
hopx run 'print("hello")' --template python --keep
```

## File Operations

```bash
# Read file
hopx files read /app/config.json --sandbox <id>

# Write file
hopx files write /app/data.txt --content "hello" --sandbox <id>

# Upload local file
hopx files upload ./local.py /app/script.py --sandbox <id>

# Download file
hopx files download /app/output.txt ./local.txt --sandbox <id>

# List directory
hopx files list /app --sandbox <id>

# Delete file
hopx files delete /app/temp.txt --sandbox <id>
```

## Configuration

```bash
# Show config
hopx config show

# Set value
hopx config set default_template nodejs
hopx config set output_format json

# Profile management
hopx config profile list
hopx config profile create staging
hopx config profile use staging
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `HOPX_API_KEY` | API key for authentication |
| `HOPX_BASE_URL` | API base URL |
| `HOPX_PROFILE` | Configuration profile |
| `HOPX_DEFAULT_TEMPLATE` | Default template |
| `HOPX_DEFAULT_TIMEOUT` | Default timeout (seconds) |

## Output Formats

```bash
# Table (default)
hopx sandbox list

# JSON
hopx sandbox list --output json

# Plain text
hopx sandbox list --output plain

# Disable colors
hopx sandbox list --no-color
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation error |
| 3 | Authentication error |
| 4 | Not found |
| 5 | Timeout |
| 6 | Network error |
| 7 | Rate limit exceeded |
| 130 | Interrupted (Ctrl+C) |

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Run tests
bun test

# Build
bun run build

# Build standalone binaries
bun run build:bin
```

## Links

- Website: https://hopx.ai
- Documentation: https://docs.hopx.ai/cli
- Dashboard: https://hopx.ai/dashboard
- GitHub: https://github.com/hopx-ai/cli
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## License

MIT
