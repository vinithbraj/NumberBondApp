#!/bin/sh

APP_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
"$APP_DIR/install.sh"
STATUS=$?

printf '\n'
if [ "$STATUS" -eq 0 ]; then
  printf 'Number Bonds is ready. Double-click Start.command whenever you want to play.\n'
else
  printf 'Installation did not finish. Review the message above, then try again.\n'
fi
printf 'Press Return to close this window...'
read -r _unused
exit "$STATUS"
