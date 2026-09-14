#!/usr/bin/env bash
# Reminds Claude once per session when user-facing code changed without a docs change.
set -euo pipefail

# Node is required by this repo; jq is the fallback. Without either, the reminder is skipped.
read_fields() {
  if command -v node >/dev/null 2>&1; then
    node -e '
      let data = "";
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => {
        const input = JSON.parse(data);
        process.stdout.write([String(input.stop_hook_active ?? false), String(input.session_id ?? "")].join("\n"));
      });
    '
  elif command -v jq >/dev/null 2>&1; then
    jq -r '[(.stop_hook_active // false | tostring), (.session_id // "")] | .[]'
  else
    return 1
  fi
}

emit_block() {
  if command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(JSON.stringify({ decision: "block", reason: process.argv[1] }))' "$1"
  else
    jq -n --arg reason "$1" '{decision: "block", reason: $reason}'
  fi
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

INPUT=$(cat)
if ! FIELDS=$(printf '%s' "$INPUT" | read_fields); then
  echo "WARNING: docs-reminder hook skipped because neither node nor jq is available." >&2
  exit 0
fi
[ "$(printf '%s\n' "$FIELDS" | sed -n '1p')" = "true" ] && exit 0
SESSION_ID=$(printf '%s\n' "$FIELDS" | sed -n '2p' | tr -cd '[:alnum:]_-')

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

[ -z "$SESSION_ID" ] && exit 0

REMINDER_STATE_DIR="${TMPDIR:-/tmp}/openjii-docs-reminder"
REMINDER_MARKER="$REMINDER_STATE_DIR/$SESSION_ID"
[ -e "$REMINDER_MARKER" ] && exit 0

mkdir -p "$REMINDER_STATE_DIR"
touch "$REMINDER_MARKER"

emit_block "User-facing files changed but apps/docs/content did not. If this alters what a user sees or does, update the docs and re-capture screenshots. See the openjii-docs-update skill."
