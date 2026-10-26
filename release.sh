#!/usr/bin/env bash
REVISION="${1:-2.0.0-beta01}"
EXPECTED_BRANCH="${2:-${RELEASE_BRANCH:-dev69}}"
set -euo pipefail

# Wrapper for the npm-based release flow (see RELEASE.md).
# Usage: ./release.sh [version] [branch]
# scripts/release.js requires a clean working tree (a modified ReleaseNotes.md alone is committed
# automatically), bumps package.json, commits, tags without a "v" prefix, and pushes.
# Release tracker-core first: the tracker's release resolves this tag from GitHub.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "${CURRENT_BRANCH}" != "${EXPECTED_BRANCH}" ]]; then
  echo "Error: tracker-core ${REVISION} must be released from ${EXPECTED_BRANCH}; current branch is ${CURRENT_BRANCH:-detached HEAD}." >&2
  exit 1
fi

echo "Revision:  ${REVISION}"
echo "Branch:    ${CURRENT_BRANCH}"

RELEASE_BRANCH="${EXPECTED_BRANCH}" npm run release "${REVISION}"
