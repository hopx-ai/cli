# Changelog

All notable changes to the Hopx CLI are documented here.

## [0.2.2] — Complete `auth login`: token persistence and provider picker

0.2.1 fixed the 404 on `hopx auth login` so the browser flow could
complete, but the tokens the backend returned were dropped instead
of being saved, and the CLI hardcoded Google as the only identity
provider. 0.2.2 finishes the job.

### Fixed

- **`hopx auth login` now actually persists credentials.** After a
  successful OAuth round-trip, the CLI writes the returned
  `access_token`, `refresh_token`, and `expires_at` to the keyring
  (or to `~/.hopx/credentials.yaml` when the keyring is unavailable)
  via the same helpers the Python CLI uses. `hopx auth status` now
  reports "Authenticated" immediately after login, and commands that
  need an access token can read it without a second round-trip.

### Added

- **`--provider` flag** for `hopx auth login`. Accepts any WorkOS
  connection identifier — `GoogleOAuth`, `GitHubOAuth`,
  `MicrosoftOAuth`, `GitLabOAuth`, or anything the backend exposes.
  Matches the Python CLI's `--provider` for parity. Use in scripts
  or CI where you know which identity provider to use:

  ```
  hopx auth login --provider GitHubOAuth
  ```

- **Interactive provider picker** when `--provider` is omitted in a
  TTY. The CLI calls `GET /auth/providers` (no auth required) to
  fetch the list of configured identity providers from the backend
  and shows a numbered prompt. The list is server-driven, so new
  providers added on the Hopx backend appear in the picker without
  a CLI release. If the server is unreachable, the CLI falls back
  to a static list (Google, GitHub, Microsoft) with a warning.

- **Non-interactive fallback**. When there is no TTY (piped stdin,
  CI environments) and `--provider` is not passed, the CLI silently
  defaults to `GoogleOAuth`. Matches previous behavior and keeps
  existing scripts working unchanged.

### Changed

- The internal `Provider` type in `src/lib/auth/oauth.ts` was relaxed
  from a whitelist union (`"GoogleOAuth" | "GitHubOAuth" | ...`) to
  `string`. The CLI no longer validates provider IDs client-side —
  the server's `/auth/providers` response is authoritative, and
  WorkOS returns an error if an unknown provider slips through. This
  is an internal change; no user-visible behavior difference except
  that providers the CLI did not previously know about are now
  accepted.

### Known issue

- The interactive picker is not yet covered by CI. Its logic is a
  minimal readline-based numbered prompt with unit tests on the
  fetch half; the TTY half would need a PTY harness which is tracked
  for a later release.

## [0.2.1] — Fix broken `auth login`

Bugfix release. `hopx auth login` in 0.2.0 was non-functional: it
opened the browser to `https://api.hopx.dev/auth/cli?callback=...`
which returned 404, because that endpoint does not exist on the
Hopx API. The OAuth module in the Bun port was a placeholder that
never matched the real WorkOS-backed flow the Python CLI uses.

### Fixed

- **`hopx auth login`** now opens the browser to WorkOS
  (`api.workos.com/user_management/authorize`) with the Hopx CLI's
  public client ID, a CSRF `state` nonce, and the fixed callback
  URI `http://127.0.0.1:39123/callback` that WorkOS has pre-
  registered for the CLI application. After the user authenticates,
  the callback handler verifies `state`, extracts the authorization
  `code`, and exchanges it for tokens via
  `POST ${HOPX_BASE_URL}/auth/workos-callback`, matching the Python
  CLI flow byte-for-byte.
- A clear `EADDRINUSE` message is shown if port 39123 is already
  bound (usually because another `hopx auth login` is running).
- Provider-supplied error messages are HTML-escaped in the failure
  page.

### Known issue (not fixed in 0.2.1, tracked for 0.2.2)

- `hopx auth login` completes the browser flow successfully but the
  returned access/refresh tokens are not persisted yet — the login
  handler in `src/commands/auth.ts` only stores an API key, which
  this OAuth flow does not return. As a result, `hopx auth status`
  will still report "not authenticated" after login. Use
  `hopx auth login --api-key hopx_live_...` as a workaround until
  0.2.2 lands.

## [0.2.0] — First release of the Bun rewrite

The 0.2.0 release replaces the Python CLI (`hopx-cli` on PyPI) with a
Bun/TypeScript implementation distributed as single-binary downloads
and an npm package (`@hopx-ai/cli`). The Python package is tombstoned
on PyPI at the same version — `pip install hopx-cli==0.2.0` prints a
migration notice and exits.

### Breaking changes

- **Runtime**: moved from Python 3.12+ to Bun/Node.js. Users no longer
  need a Python installation. The standalone binaries have no runtime
  dependency at all.
- **Repository**: the CLI now lives at
  [github.com/hopx-ai/cli](https://github.com/hopx-ai/cli). The source
  previously lived under `cli/` (Python) and `cli-bun/` (experimental)
  in the `hopx-ai/hopx` monorepo.
- **Install command**: the canonical installer URL is now
  `https://raw.githubusercontent.com/hopx-ai/cli/main/install.sh`.

### Migration

- **Config**: `~/.hopx/config.yaml` is preserved and works unchanged.
- **Credentials**: on first run, the new CLI **automatically migrates**
  keyring records from the Python CLI's account layout
  (`<profile>:api_key`, `<profile>:oauth_access`, etc.) into the Bun
  CLI's single-blob format. You do not need to re-authenticate. Set
  `HOPX_NO_MIGRATE=1` to opt out.
- **File fallback**: `~/.hopx/credentials.yaml` (used when the keyring
  is unavailable) is now read as YAML, matching what the Python CLI
  wrote. JSON-format files from experimental cli-bun 0.1.x builds are
  still read for forward compatibility.
- **Uninstall the old package**: `pipx uninstall hopx-cli` (or
  `uv tool uninstall hopx-cli`, or `pip uninstall hopx-cli`).

### New features

- **SHA256 checksum verification** during `curl | bash` install. The
  installer downloads `SHA256SUMS` alongside the binary and verifies
  the hash before execution. Skip with `HOPX_SKIP_CHECKSUM=1`.
- **`keytar` is now an optional dependency** — missing native prebuilds
  (linux-arm64, musl libc, etc.) no longer break `npm install -g`;
  credentials fall through to the encrypted file store.

### Removed commands

The following Python CLI commands have no Bun equivalent in 0.2.0 and
will be added in later releases if requested:

- `hopx auth refresh`, `hopx auth validate`, `hopx auth keys info`
- `hopx billing auto-recharge`, `hopx billing balance`,
  `hopx billing history`
- `hopx cmd exec` (use `hopx cmd run`)
- `hopx config init`, `hopx config path`
- `hopx env load`
- `hopx files info`
- `hopx org list`, `hopx org switch`, `hopx org update`
- `hopx profile update`
- `hopx run kill`, `hopx run ps`
- `hopx sandbox connect`, `hopx sandbox expiry`, `hopx sandbox health`,
  `hopx sandbox token`, `hopx sandbox url`
- `hopx system agent-info`, `hopx system jupyter`,
  `hopx system processes`, `hopx system snapshot`
- `hopx terminal connect`, `hopx terminal info`, `hopx terminal url`
- `hopx usage history`, `hopx usage plans`, `hopx usage sandboxes`

### Renamed commands

| Python CLI | Bun CLI 0.2.0 |
| --- | --- |
| `hopx auth keys` | `hopx auth api-keys` |
| `hopx auth keys create/list/revoke` | `hopx auth api-keys create/list/revoke` |
| `hopx env delete` | `hopx env unset` |
| `hopx config profiles` | `hopx config profile` (singular) |
| `hopx config profiles create/delete/list/use` | `hopx config profile create/delete/list/use` |
| `hopx org list` + `org update` | `hopx org settings` |
| `hopx billing auto-recharge` / `balance` / `history` | `hopx billing info` / `plan` / `portal` |
| `hopx usage history` / `plans` / `sandboxes` | `hopx usage daily` / `by-template` |

### Changed: sandbox ID is now an option, not a positional

The Python CLI took `sandbox_id` as a required positional argument on
most file, env, cmd, and sandbox subcommands. The Bun CLI takes it as
a `--sandbox <id>` option. Scripts must be updated:

```bash
# Python CLI (0.1.x)
hopx files read $SB_ID /app/config.json
hopx cmd run $SB_ID "ls -la"
hopx env set $SB_ID KEY value

# Bun CLI (0.2.0)
hopx files read /app/config.json --sandbox $SB_ID
hopx cmd run "ls -la" --sandbox $SB_ID
hopx env set KEY=value --sandbox $SB_ID
```

Commands affected: `cmd run`, `env get/list/set`, `files delete/
download/list/read/upload/write`.

### Removed options

Top-level `hopx` command:
- `--install-completion`, `--show-completion` — shell completions are
  not ported yet (see Known regressions).
- `--quiet`, `--verbose` — log-level control is not yet implemented.
  Use `--output json` for structured, parseable output.

Individual commands lost the following options (full list in
[`parity-diff.txt`](https://github.com/hopx-ai/cli/pull/1) when we
publish it):

- `hopx auth login`: `--no-browser`, `--provider`
- `hopx run`: `--background`, `--env`, `--file`, `--full`,
  `--no-pager`, `--preflight`
- `hopx sandbox create`: `--env-file`, `--no-internet`, `--region`,
  `--template-id`, `--wait`
- `hopx template build`: `--context`, `--disk`, `--no-cache`,
  `--update`
- `hopx template list`: `--category`, `--language`, `--public`
- `hopx sandbox kill`, `files delete`, `members remove`,
  `template delete`: `--force` renamed to `--yes`

### Known regressions

- **`hopx self-update`** is now a guidance message (pointing at the
  installer and the npm upgrade command), not an in-place updater. The
  standalone-binary distribution model makes in-place updates a hint
  rather than a full feature.
- **Shell completions** (Typer's `--install-completion`) are not yet
  ported. Tracking issue will follow in a later release.
- **Windows `install.ps1`** is not yet shipped. Windows users should
  download the `.exe` directly from the
  [latest release](https://github.com/hopx-ai/cli/releases/latest).
- **Rich-formatted output** (ASCII art, box-drawing tables) is replaced
  by simpler `chalk` + `cli-table3` styling. Scripts parsing stdout
  should use `--output json` for a stable format across releases.

### For pinned CI users

If you have `hopx-cli==0.1.2` pinned in CI, it continues to work
indefinitely — the 0.1.x releases are never yanked from PyPI. To move
to the new CLI, replace the `pip install` line with the curl-based
installer shown above.
