#!/usr/bin/env bash
# Reminds Claude once per session when user-facing code changed without a docs change.
set -euo pipefail

INPUT=$(cat)
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

changed=$( { git diff --name-only HEAD; git diff --cached --name-only; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u )

echo "$changed" | grep -qE '^apps/(web|mobile)/' || exit 0
echo "$changed" | grep -qE '^apps/docs/content/' && exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' | tr -cd '[:alnum:]_-')
[ -z "$SESSION_ID" ] && exit 0

REMINDER_STATE_DIR="${TMPDIR:-/tmp}/openjii-docs-reminder"
REMINDER_MARKER="$REMINDER_STATE_DIR/$SESSION_ID"
[ -e "$REMINDER_MARKER" ] && exit 0

mkdir -p "$REMINDER_STATE_DIR"
touch "$REMINDER_MARKER"

REASON="User-facing files changed but apps/docs/content did not. If this alters what a user sees or does, update the docs and re-capture screenshots. See the openjii-docs-update skill."
jq -n --arg reason "$REASON" '{decision: "block", reason: $reason}'
