#!/usr/bin/env bash
# Reminds Claude once per session when user-facing code changed without a docs change.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: docs-reminder hook skipped because jq is not installed." >&2
  exit 0
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

INPUT=$(cat)
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

BASE_COMMIT=$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null || true)
changed=$( {
  if [ -n "$BASE_COMMIT" ]; then
    git diff --name-only "$BASE_COMMIT" HEAD
  fi
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} 2>/dev/null | sort -u )

grep -qE '^apps/(web|mobile)/' <<<"$changed" || exit 0
grep -qE '^apps/docs/content/' <<<"$changed" && exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' | tr -cd '[:alnum:]_-')
[ -z "$SESSION_ID" ] && exit 0

REMINDER_STATE_DIR="${TMPDIR:-/tmp}/openjii-docs-reminder"
REMINDER_MARKER="$REMINDER_STATE_DIR/$SESSION_ID"
[ -e "$REMINDER_MARKER" ] && exit 0

mkdir -p "$REMINDER_STATE_DIR"
touch "$REMINDER_MARKER"

REASON="User-facing files changed but apps/docs/content did not. If this alters what a user sees or does, update the docs and re-capture screenshots. See the openjii-docs-update skill."
jq -n --arg reason "$REASON" '{decision: "block", reason: $reason}'
