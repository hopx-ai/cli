#!/bin/bash
# Hopx CLI installer script
# Usage: curl -fsSL https://hopx.ai/install.sh | bash

set -e

REPO="hopx-ai/hopx"
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

# Get latest release version
get_latest_version() {
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | \
        sed -E 's/.*"v([^"]+)".*/\1/'
}

# Download and install binary
install_binary() {
    local platform="$1"
    local version="${2:-latest}"

    if [ "$version" = "latest" ]; then
        version=$(get_latest_version)
        if [ -z "$version" ]; then
            error "Could not determine latest version"
        fi
    fi

    local binary_name="hopx-${platform}"
    if [ "$platform" = "windows-x64" ]; then
        binary_name="${binary_name}.exe"
    fi

    local download_url="https://github.com/${REPO}/releases/download/v${version}/cli-bun-${binary_name}"

    info "Downloading Hopx CLI v${version} for ${platform}..."

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Download binary
    local temp_file=$(mktemp)
    if ! curl -fsSL "$download_url" -o "$temp_file"; then
        rm -f "$temp_file"
        error "Failed to download binary from ${download_url}"
    fi

    # Move to install directory
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"
    if [ "$platform" = "windows-x64" ]; then
        install_path="${install_path}.exe"
    fi

    mv "$temp_file" "$install_path"
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

    local platform=$(detect_platform)
    local version="${1:-latest}"

    info "Detected platform: ${platform}"

    install_binary "$platform" "$version"
    setup_path
    verify_install
}

main "$@"
