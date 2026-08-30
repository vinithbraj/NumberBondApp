#!/bin/sh

# Serve the prebuilt app locally and open it in the default browser.
set -eu

APP_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
NODE_DIR="$APP_DIR/.runtime/node"
NODE_BIN="$NODE_DIR/bin/node"

fail() {
  printf '\nCould not start Number Bonds: %s\n' "$1" >&2
  exit 1
}

if [ "$(uname -s)" != "Darwin" ]; then
  fail "the one-click startup script supports macOS only."
fi

[ -x "$NODE_BIN" ] || fail "the local runtime is missing. Run ./install.sh (or Install.command) first."
[ -f "$APP_DIR/package.json" ] || fail "package.json is missing. Restore the complete app and run the installer again."
[ -f "$APP_DIR/dist/index.html" ] || fail "the built app is missing. Run ./install.sh (or Install.command) first."
[ -d "$APP_DIR/node_modules" ] || fail "installed packages are missing. Run ./install.sh (or Install.command) first."

PATH="$NODE_DIR/bin:$PATH"
export PATH

port_is_available() {
  "$NODE_BIN" -e '
    const net = require("node:net");
    const server = net.createServer();
    server.unref();
    server.once("error", () => process.exit(1));
    server.listen({ host: "127.0.0.1", port: Number(process.argv[1]) }, () => {
      server.close(() => process.exit(0));
    });
  ' "$1" >/dev/null 2>&1
}

PORT=4173
LAST_PORT=4273
while [ "$PORT" -le "$LAST_PORT" ]; do
  if port_is_available "$PORT"; then
    break
  fi
  PORT=$((PORT + 1))
done

if [ "$PORT" -gt "$LAST_PORT" ]; then
  fail "no free local port was found between 4173 and 4273. Close another local server and try again."
fi

URL="http://127.0.0.1:$PORT"
printf 'Number Bonds is starting at %s\n' "$URL"
printf 'Keep this window open while using the app. Press Control-C to stop it.\n\n'

cd "$APP_DIR"
exec npm run preview -- --host 127.0.0.1 --port "$PORT" --strictPort --open
