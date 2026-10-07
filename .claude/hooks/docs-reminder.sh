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

STATE_DIR="${TMPDIR:-/tmp}/openjii-docs-reminder"
BASE_FILE="$STATE_DIR/$SESSION_ID.base"
UNTRACKED_FILE="$STATE_DIR/$SESSION_ID.untracked"
REMINDER_MARKER="$STATE_DIR/$SESSION_ID"
mkdir -p "$STATE_DIR"

# At session start, snapshot what the checkout already holds, so work from earlier sessions on the
# same branch never counts. `git stash create` writes a commit without touching the stash list. A
# resumed session keeps its first snapshot.
if [ "$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty')" = "SessionStart" ]; then
  if [ ! -e "$BASE_FILE" ]; then
    snapshot=$(git stash create 2>/dev/null || true)
    [ -z "$snapshot" ] && snapshot=$(git rev-parse HEAD 2>/dev/null || true)
    git ls-files --others --exclude-standard > "$UNTRACKED_FILE"
    printf '%s\n' "$snapshot" > "$BASE_FILE"
  fi
  exit 0
fi

[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
[ -e "$REMINDER_MARKER" ] && exit 0

if [ -s "$BASE_FILE" ]; then
  BASE=$(cat "$BASE_FILE")
  changed=$( {
    git diff --name-only "$BASE"
    git ls-files --others --exclude-standard | grep -vxF -f "$UNTRACKED_FILE" || true
  } 2>/dev/null | sort -u )
else
  BASE_COMMIT=$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null || true)
  changed=$( {
    if [ -n "$BASE_COMMIT" ]; then
      git diff --name-only "$BASE_COMMIT" HEAD
    fi
    git diff --name-only HEAD
    git ls-files --others --exclude-standard
  } 2>/dev/null | sort -u )
fi

grep -qE '^apps/(web|mobile)/' <<<"$changed" || exit 0
grep -qE '^apps/docs/content/' <<<"$changed" && exit 0

touch "$REMINDER_MARKER"

REASON="User-facing files changed but apps/docs/content did not. If this alters what a user sees or does, update the docs and re-capture screenshots. See the openjii-docs-update skill."
jq -n --arg reason "$REASON" '{decision: "block", reason: $reason}'
