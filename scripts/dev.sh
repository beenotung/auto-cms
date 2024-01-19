#!/bin/bash
set -e
set -o pipefail
node scripts/esbuild.js
toclip dist/browser.js
