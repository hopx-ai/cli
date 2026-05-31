#!/usr/bin/env bash
#
# Cut a GitHub release for the current package.json version.
#
# The release is tagged `cli-v<version>`, which triggers
# .github/workflows/publish.yml to build the standalone binaries, attach them
# to the release, and publish @hopx-ai/cli to npm (when NPM_TOKEN is set).
#
# This script does NOT bump the version — prepare package.json, src/version.ts,
# and a matching CHANGELOG.md section first (usually in the feature PR), then
# run this from `main` after the PR is merged.
#
# Usage:
#   mise run release             # cut the release
#   mise run release -- --dry-run   # show what would happen, create nothing
#   ./scripts/release.sh --dry-run

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "error: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "✗ $1" >&2; exit 1; }
ok()   { echo "✓ $1"; }

VERSION="$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')"
[ -n "$VERSION" ] || fail "could not read version from package.json"
TAG="cli-v$VERSION"
echo "Preparing release $TAG"
echo

# --- Preconditions -----------------------------------------------------------

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || fail "must be on 'main' (currently on '$BRANCH')"
ok "on main"

[ -z "$(git status --porcelain)" ] || fail "working tree is dirty — commit or stash first"
ok "working tree clean"

git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
  || fail "local main differs from origin/main — push or pull first"
ok "in sync with origin/main"

FILE_VERSION="$(grep -E 'VERSION *= *"' src/version.ts | sed -E 's/.*"([^"]+)".*/\1/')"
[ "$FILE_VERSION" = "$VERSION" ] \
  || fail "src/version.ts ($FILE_VERSION) != package.json ($VERSION) — run the build/generator"
ok "src/version.ts matches ($VERSION)"

grep -qE "^## \[$VERSION\]" CHANGELOG.md \
  || fail "no '## [$VERSION]' section in CHANGELOG.md"
ok "CHANGELOG has a [$VERSION] section"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null \
   || git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1; then
  fail "tag $TAG already exists — bump the version for a new release"
fi
ok "tag $TAG is free"

# --- Release notes (CHANGELOG body for this version, header stripped) ---------

NOTES="$(awk -v ver="$VERSION" '
  index($0, "## [" ver "]") == 1 { p = 1; next }
  p && /^## \[/ { exit }
  p { print }
' CHANGELOG.md | sed -e '/./,$!d')"   # drop leading blank lines

[ -n "$NOTES" ] || fail "extracted empty release notes for $VERSION"

# --- Create (or preview) -----------------------------------------------------

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "DRY RUN — would create release $TAG on $(git rev-parse --short HEAD) with notes:"
  echo "------------------------------------------------------------"
  echo "$NOTES"
  echo "------------------------------------------------------------"
  echo "Run without --dry-run to publish."
  exit 0
fi

NOTES_FILE="$(mktemp)"
trap 'rm -f "$NOTES_FILE"' EXIT
printf '%s\n' "$NOTES" > "$NOTES_FILE"

echo
echo "Creating release $TAG..."
gh release create "$TAG" --target main --title "$TAG" --notes-file "$NOTES_FILE"

echo
ok "release $TAG created"
echo "Publish workflow: gh run watch \$(gh run list --workflow=publish.yml --limit=1 --json databaseId --jq '.[0].databaseId')"
