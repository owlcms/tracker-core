#!/usr/bin/env bash
REVISION="${1:-2.0.0-beta01}"
set -euo pipefail

# Wrapper for the npm-based release flow (see RELEASE.md).
# scripts/release.js requires a clean working tree (a modified ReleaseNotes.md alone is committed
# automatically), bumps package.json, commits, tags without a "v" prefix, and pushes.
# Release tracker-core first: the tracker's release resolves this tag from GitHub.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "Revision:  ${REVISION}"

npm run release "${REVISION}"
