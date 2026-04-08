#!/bin/bash
# Hopx CLI installer script
# Usage: curl -fsSL https://raw.githubusercontent.com/hopx-ai/cli/main/install.sh | bash
#
# Environment variables:
#   HOPX_INSTALL_DIR     Install directory (default: $HOME/.hopx/bin)
#   HOPX_SKIP_CHECKSUM   Skip SHA256 verification (not recommended)

set -e

REPO="hopx-ai/cli"
INSTALL_DIR="${HOPX_INSTALL_DIR:-$HOME/.hopx/bin}"
BINARY_NAME="hopx"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}==>${NC} $1"
}

warn() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

error() {
    echo -e "${RED}Error:${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    local os arch

    case "$(uname -s)" in
        Darwin)  os="darwin" ;;
        Linux)   os="linux" ;;
        MINGW*|MSYS*|CYGWIN*) os="windows" ;;
        *)       error "Unsupported operating system: $(uname -s)" ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)  arch="x64" ;;
        arm64|aarch64) arch="arm64" ;;
        *)             error "Unsupported architecture: $(uname -m)" ;;
    esac

    echo "${os}-${arch}"
}

# Get latest release tag (e.g. "cli-v0.2.0"). The new repo uses the
# cli-v* tag prefix for CLI releases.
get_latest_tag() {
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | \
        head -n1 | \
        sed -E 's/.*"tag_name":[[:space:]]*"([^"]+)".*/\1/'
}

# Verify SHA256 checksum. Takes the path to the downloaded binary and
# the expected filename (for matching against SHA256SUMS).
verify_checksum() {
    local binary_path="$1"
    local binary_filename="$2"
    local sums_file="$3"

    if [ "${HOPX_SKIP_CHECKSUM:-}" = "1" ]; then
        warn "Skipping checksum verification (HOPX_SKIP_CHECKSUM=1)"
        return 0
    fi

    # Extract the expected hash for our binary
    local expected_hash
    expected_hash=$(grep " ${binary_filename}\$" "$sums_file" | awk '{print $1}')

    if [ -z "$expected_hash" ]; then
        error "No checksum found for ${binary_filename} in SHA256SUMS"
    fi

    # Compute the actual hash (shasum on macOS, sha256sum on Linux)
    local actual_hash
    if command -v sha256sum >/dev/null 2>&1; then
        actual_hash=$(sha256sum "$binary_path" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        actual_hash=$(shasum -a 256 "$binary_path" | awk '{print $1}')
    else
        warn "Neither sha256sum nor shasum available; skipping checksum"
        return 0
    fi

    if [ "$expected_hash" != "$actual_hash" ]; then
        error "Checksum mismatch for ${binary_filename} (expected ${expected_hash}, got ${actual_hash})"
    fi

    info "Checksum verified"
}

# Download and install binary
install_binary() {
    local platform="$1"
    local tag="${2:-latest}"

    if [ "$tag" = "latest" ]; then
        tag=$(get_latest_tag)
        if [ -z "$tag" ]; then
            error "Could not determine latest release tag"
        fi
    fi

    local binary_filename="hopx-${platform}"
    if [ "$platform" = "windows-x64" ]; then
        binary_filename="${binary_filename}.exe"
    fi

    local base_url="https://github.com/${REPO}/releases/download/${tag}"
    local download_url="${base_url}/${binary_filename}"
    local sums_url="${base_url}/SHA256SUMS"

    info "Downloading Hopx CLI ${tag} for ${platform}..."

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Download binary to temp file
    local temp_binary
    temp_binary=$(mktemp)
    if ! curl -fsSL "$download_url" -o "$temp_binary"; then
        rm -f "$temp_binary"
        error "Failed to download binary from ${download_url}"
    fi

    # Download checksums file
    local temp_sums
    temp_sums=$(mktemp)
    if curl -fsSL "$sums_url" -o "$temp_sums"; then
        verify_checksum "$temp_binary" "$binary_filename" "$temp_sums"
    else
        warn "Could not download SHA256SUMS from ${sums_url}; skipping verification"
    fi
    rm -f "$temp_sums"

    # Move to install directory
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"
    if [ "$platform" = "windows-x64" ]; then
        install_path="${install_path}.exe"
    fi

    mv "$temp_binary" "$install_path"
    chmod +x "$install_path"

    info "Installed to ${install_path}"
}

# Add to PATH
setup_path() {
    local shell_config=""

    case "$SHELL" in
        */zsh)  shell_config="$HOME/.zshrc" ;;
        */bash) shell_config="$HOME/.bashrc" ;;
        */fish) shell_config="$HOME/.config/fish/config.fish" ;;
    esac

    if [ -n "$shell_config" ]; then
        local path_line="export PATH=\"\$PATH:${INSTALL_DIR}\""

        if [ "$SHELL" = "*/fish" ]; then
            path_line="set -gx PATH \$PATH ${INSTALL_DIR}"
        fi

        if ! grep -q "$INSTALL_DIR" "$shell_config" 2>/dev/null; then
            echo "" >> "$shell_config"
            echo "# Hopx CLI" >> "$shell_config"
            echo "$path_line" >> "$shell_config"
            info "Added ${INSTALL_DIR} to PATH in ${shell_config}"
            warn "Run 'source ${shell_config}' or restart your terminal"
        fi
    else
        warn "Could not detect shell config. Add ${INSTALL_DIR} to your PATH manually."
    fi
}

# Verify installation
verify_install() {
    if [ -x "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        info "Verifying installation..."
        "${INSTALL_DIR}/${BINARY_NAME}" --version
        echo ""
        info "Installation complete!"
        echo ""
        echo "Get started:"
        echo "  hopx init           # First-time setup"
        echo "  hopx sandbox create # Create a sandbox"
        echo "  hopx --help         # See all commands"
    else
        error "Installation verification failed"
    fi
}

main() {
    echo ""
    echo "  _   _                   "
    echo " | | | | ___  _ __ __  __ "
    echo " | |_| |/ _ \| '_ \\ \/ / "
    echo " |  _  | (_) | |_) |>  <  "
    echo " |_| |_|\___/| .__//_/\_\ "
    echo "             |_|          "
    echo ""
    echo "Hopx CLI Installer"
    echo ""

    local platform
    platform=$(detect_platform)
    local tag="${1:-latest}"

    info "Detected platform: ${platform}"

    install_binary "$platform" "$tag"
    setup_path
    verify_install
}

main "$@"
