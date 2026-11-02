#!/usr/bin/env bash
# Run the DSH CLI from the desktop install. Set DSH_HOME to isolate from ~/.dsh.
APP="${DSH_APP_DIR:-$LOCALAPPDATA/Programs/DeepSeek Harness}"
ELECTRON_RUN_AS_NODE=1 exec "$APP/DeepSeek Harness.exe" --expose-internals \
  "$APP/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js" "$@"
