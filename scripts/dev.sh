#!/bin/bash
set -e
set -o pipefail
npm run build
toclip public/auto-cms.js
