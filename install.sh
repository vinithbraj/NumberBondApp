#!/bin/sh

# Install a private Node.js runtime and this app's dependencies on macOS.
set -eu

APP_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
RUNTIME_DIR="$APP_DIR/.runtime"
CURRENT_NODE_DIR="$RUNTIME_DIR/node"
INSTALL_TEMP=""

cleanup() {
  if [ -n "$INSTALL_TEMP" ] && [ -d "$INSTALL_TEMP" ]; then
    rm -rf "$INSTALL_TEMP"
  fi
}

trap cleanup 0
trap 'exit 130' HUP INT TERM

fail() {
  printf '\nInstallation stopped: %s\n' "$1" >&2
  exit 1
}

if [ "$(uname -s)" != "Darwin" ]; then
  fail "this installer supports macOS 11 or newer only."
fi

MACOS_VERSION=$(sw_vers -productVersion 2>/dev/null) || fail "could not determine the macOS version."
MACOS_MAJOR=${MACOS_VERSION%%.*}
MACOS_REMAINDER=${MACOS_VERSION#*.}
MACOS_MINOR=${MACOS_REMAINDER%%.*}

case "$MACOS_MAJOR:$MACOS_MINOR" in
  *[!0-9:]* | :* | *:)
    fail "could not understand macOS version '$MACOS_VERSION'."
    ;;
esac

if [ "$MACOS_MAJOR" -lt 11 ]; then
  fail "macOS $MACOS_VERSION is not supported. Upgrade to macOS 11 or newer."
fi

MACHINE_ARCH=$(uname -m)
if [ "$MACHINE_ARCH" = "x86_64" ] && [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" = "1" ]; then
  MACHINE_ARCH="arm64"
fi

case "$MACHINE_ARCH" in
  arm64)
    NODE_PLATFORM="darwin-arm64"
    ;;
  x86_64)
    NODE_PLATFORM="darwin-x64"
    ;;
  *)
    fail "this Mac's processor architecture ($MACHINE_ARCH) is not supported. Use an Intel or Apple Silicon Mac."
    ;;
esac

if [ "$MACOS_MAJOR" -gt 13 ] || { [ "$MACOS_MAJOR" -eq 13 ] && [ "$MACOS_MINOR" -ge 5 ]; }; then
  NODE_VERSION="24.20.0"
else
  NODE_VERSION="22.23.2"
fi

case "$NODE_VERSION:$NODE_PLATFORM" in
  24.20.0:darwin-arm64)
    NODE_SHA256="40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8"
    ;;
  24.20.0:darwin-x64)
    NODE_SHA256="9e5b2644cf107befb6aefca676b96d3296bc10138096f022ed378d6233ed81f4"
    ;;
  22.23.2:darwin-arm64)
    NODE_SHA256="61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6"
    ;;
  22.23.2:darwin-x64)
    NODE_SHA256="58e99022c2ff89395576cc7fd4d98cea24bb68081475d5f88b801ee8729fb026"
    ;;
  *)
    fail "no trusted Node.js archive is configured for this Mac."
    ;;
esac

NODE_ARCHIVE_NAME="node-v$NODE_VERSION-$NODE_PLATFORM.tar.gz"
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/$NODE_ARCHIVE_NAME"
VERSIONED_NODE_DIR="$RUNTIME_DIR/node-v$NODE_VERSION-$NODE_PLATFORM"

[ -f "$APP_DIR/package.json" ] || fail "package.json is missing. Restore the complete app and try again."
[ -f "$APP_DIR/package-lock.json" ] || fail "package-lock.json is missing. Restore the complete app and try again."
command -v curl >/dev/null 2>&1 || fail "the built-in curl command is unavailable."
command -v shasum >/dev/null 2>&1 || fail "the built-in shasum command is unavailable."
command -v tar >/dev/null 2>&1 || fail "the built-in tar command is unavailable."

mkdir -p "$RUNTIME_DIR"

RUNTIME_READY=false
if [ -x "$VERSIONED_NODE_DIR/bin/node" ]; then
  INSTALLED_VERSION=$("$VERSIONED_NODE_DIR/bin/node" --version 2>/dev/null || true)
  if [ "$INSTALLED_VERSION" = "v$NODE_VERSION" ]; then
    RUNTIME_READY=true
  fi
fi

if [ "$RUNTIME_READY" = false ]; then
  printf 'Preparing Node.js %s for %s...\n' "$NODE_VERSION" "$NODE_PLATFORM"
  INSTALL_TEMP=$(mktemp -d "$RUNTIME_DIR/.install.XXXXXX") || fail "could not create a temporary install folder."
  DOWNLOADED_ARCHIVE="$INSTALL_TEMP/$NODE_ARCHIVE_NAME"

  if ! curl --fail --location --retry 3 --retry-delay 2 --connect-timeout 20 \
    --proto '=https' --tlsv1.2 --output "$DOWNLOADED_ARCHIVE" "$NODE_URL"; then
    fail "Node.js could not be downloaded. Check the internet connection and try again."
  fi

  ACTUAL_SHA256=$(shasum -a 256 "$DOWNLOADED_ARCHIVE" | awk '{print $1}')
  if [ "$ACTUAL_SHA256" != "$NODE_SHA256" ]; then
    fail "the Node.js download did not pass its SHA-256 safety check."
  fi

  if ! tar -xzf "$DOWNLOADED_ARCHIVE" -C "$INSTALL_TEMP"; then
    fail "the verified Node.js archive could not be unpacked."
  fi

  EXTRACTED_NODE_DIR="$INSTALL_TEMP/node-v$NODE_VERSION-$NODE_PLATFORM"
  [ -x "$EXTRACTED_NODE_DIR/bin/node" ] || fail "the Node.js archive did not contain the expected runtime."

  EXTRACTED_VERSION=$("$EXTRACTED_NODE_DIR/bin/node" --version 2>/dev/null || true)
  [ "$EXTRACTED_VERSION" = "v$NODE_VERSION" ] || fail "the unpacked Node.js runtime has an unexpected version."

  if [ -e "$VERSIONED_NODE_DIR" ] || [ -L "$VERSIONED_NODE_DIR" ]; then
    rm -rf "$VERSIONED_NODE_DIR"
  fi
  mv "$EXTRACTED_NODE_DIR" "$VERSIONED_NODE_DIR"
fi

if [ -e "$CURRENT_NODE_DIR" ] || [ -L "$CURRENT_NODE_DIR" ]; then
  rm -rf "$CURRENT_NODE_DIR"
fi
ln -s "$(basename "$VERSIONED_NODE_DIR")" "$CURRENT_NODE_DIR"

PATH="$CURRENT_NODE_DIR/bin:$PATH"
export PATH

printf 'Using Node.js %s and npm %s.\n' "$(node --version)" "$(npm --version)"
printf 'Installing app packages...\n'
cd "$APP_DIR"
npm ci

printf 'Checking and building the app...\n'
npm run verify

[ -f "$APP_DIR/dist/index.html" ] || fail "the build finished without creating dist/index.html."

printf '\nInstallation complete. Start Number Bonds with ./start.sh or Start.command.\n'
