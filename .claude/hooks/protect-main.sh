#!/usr/bin/env bash
# Blocks git commands that throw away local work while the repo they target is on main.
# Pushes are not checked here: GitHub's main ruleset rejects them, with no bypass.
# Adapted from mattpocock/skills git-guardrails-claude-code (MIT).
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: protect-main hook skipped because jq is not installed." >&2
  exit 0
fi

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
[ -z "$COMMAND" ] && exit 0

DESTRUCTIVE='reset[[:space:]]+--hard|clean[[:space:]]+-[A-Za-z]*f|checkout[[:space:]]+\.([[:space:]]|$)|restore[[:space:]]+\.([[:space:]]|$)'
printf '%s' "$COMMAND" | grep -qE "git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+($DESTRUCTIVE)" || exit 0

# The command's own target wins over the session's directory: `git -C <dir>`, then a `cd <dir>`.
TARGET=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$TARGET" ] && TARGET=$PWD
CD_DIR=$(printf '%s' "$COMMAND" | grep -oE '(^|[;&|][[:space:]]*)cd[[:space:]]+[^[:space:];&|]+' | tail -1 | sed -E 's/.*cd[[:space:]]+//')
GIT_C=$(printf '%s' "$COMMAND" | grep -oE 'git[[:space:]]+-C[[:space:]]+[^[:space:]]+' | tail -1 | sed -E 's/git[[:space:]]+-C[[:space:]]+//')
for DIR in "$CD_DIR" "$GIT_C"; do
  [ -z "$DIR" ] && continue
  DIR=${DIR%\"}
  DIR=${DIR#\"}
  DIR=${DIR%\'}
  DIR=${DIR#\'}
  case "$DIR" in
    "~"*) DIR="$HOME${DIR#\~}" ;;
    /*) ;;
    *) DIR="$TARGET/$DIR" ;;
  esac
  TARGET=$DIR
done

BRANCH=$(git -C "$TARGET" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$BRANCH" = "main" ] || exit 0

echo "BLOCKED: $TARGET is on main and this discards local work." >&2
echo "Switch to a branch first; on your own branches nothing is restricted." >&2
exit 2
