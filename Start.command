#!/bin/sh

APP_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
"$APP_DIR/start.sh"
STATUS=$?

printf '\nNumber Bonds stopped. Press Return to close this window...'
read -r _unused
exit "$STATUS"
