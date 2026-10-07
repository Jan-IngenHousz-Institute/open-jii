#!/usr/bin/env bash
# Reminds Claude once per session when the session changed user-facing code without a docs change.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: docs-reminder hook skipped because jq is not installed." >&2
  exit 0
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

INPUT=$(cat)
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' | tr -cd '[:alnum:]_-')
[ -z "$SESSION_ID" ] && exit 0

REMINDER_STATE_DIR="${TMPDIR:-/tmp}/openjii-docs-reminder"
REMINDER_MARKER="$REMINDER_STATE_DIR/$SESSION_ID"
SESSION_BASE_FILE="$REMINDER_STATE_DIR/$SESSION_ID.base"

# The commit the session starts from, so a session that only reads is never reminded about the
# branch it happens to sit on. A resumed session keeps its first base.
if [ "$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty')" = "SessionStart" ]; then
  mkdir -p "$REMINDER_STATE_DIR"
  [ -e "$SESSION_BASE_FILE" ] || git rev-parse HEAD >"$SESSION_BASE_FILE" 2>/dev/null || true
  exit 0
fi

[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
[ -e "$REMINDER_MARKER" ] && exit 0

SESSION_BASE=$(cat "$SESSION_BASE_FILE" 2>/dev/null || true)
session_changes=$( {
  if [ -n "$SESSION_BASE" ]; then
    git diff --name-only "$SESSION_BASE" HEAD
  fi
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} 2>/dev/null | sort -u )

grep -qE '^apps/(web|mobile)/' <<<"$session_changes" || exit 0

# Docs the branch already changed count, whichever session wrote them.
BASE_COMMIT=$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null || true)
branch_changes=""
if [ -n "$BASE_COMMIT" ]; then
  branch_changes=$(git diff --name-only "$BASE_COMMIT" HEAD 2>/dev/null || true)
fi
grep -qE '^apps/docs/content/' <<<"$session_changes"$'\n'"$branch_changes" && exit 0

mkdir -p "$REMINDER_STATE_DIR"
touch "$REMINDER_MARKER"

REASON="User-facing files changed but apps/docs/content did not. If this alters what a user sees or does, update the docs and re-capture screenshots. See the openjii-docs-update skill."
jq -n --arg reason "$REASON" '{decision: "block", reason: $reason}'
