#!/usr/bin/env bash
# Reminds when user-facing code changed without a docs change. Read-only: it
# inspects git and prints, nothing else.
set -euo pipefail

changed=$( { git diff --name-only HEAD; git diff --cached --name-only; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u )

echo "$changed" | grep -qE '^apps/(web|mobile)/' || exit 0
echo "$changed" | grep -qE '^apps/docs/content/' && exit 0

echo "User-facing files changed but apps/docs/content did not. If this alters what a user sees or does, update the docs and re-capture screenshots. See the openjii-docs-update skill."
