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

GIT_C='git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+'
DESTRUCTIVE="${GIT_C}(reset[[:space:]]+(.*[[:space:]])?--hard|clean[[:space:]]+(.*[[:space:]])?(-[A-Za-z]*f[A-Za-z]*|--force)|(checkout|restore)[[:space:]]+(.*[[:space:]])?\.)([[:space:]]|$)"
printf '%s' "$COMMAND" | grep -qE "$DESTRUCTIVE" || exit 0

DIR=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$DIR" ] && DIR=$PWD

resolve() {
  local base=$1 path=$2
  path=${path%\"}
  path=${path#\"}
  path=${path%\'}
  path=${path#\'}
  case "$path" in
    "~"*) printf '%s' "$HOME${path#\~}" ;;
    /*) printf '%s' "$path" ;;
    *) printf '%s' "$base/$path" ;;
  esac
}

# Walk the command one segment at a time, so each destructive git call is judged by
# the directory it actually runs in: the latest `cd`, then its own `git -C`.
while IFS= read -r SEGMENT; do
  SEGMENT=$(printf '%s' "$SEGMENT" | sed -E 's/^[[:space:]]+//')
  if [[ $SEGMENT =~ ^cd[[:space:]]+([^[:space:]]+) ]]; then
    DIR=$(resolve "$DIR" "${BASH_REMATCH[1]}")
    continue
  fi
  printf '%s' "$SEGMENT" | grep -qE "$DESTRUCTIVE" || continue
  TARGET=$DIR
  while [[ $SEGMENT =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+)(.*) ]]; do
    TARGET=$(resolve "$TARGET" "${BASH_REMATCH[1]}")
    SEGMENT="git ${BASH_REMATCH[2]}"
  done
  BRANCH=$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE \
    -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES -u GIT_PREFIX \
    git -C "$TARGET" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ "$BRANCH" = "main" ]; then
    echo "BLOCKED: $TARGET is on main and this discards local work." >&2
    echo "Switch to a branch first; on your own branches nothing is restricted." >&2
    exit 2
  fi
done < <(printf '%s\n' "$COMMAND" | sed -E 's/(&&|\|\||;|\|)/\n/g')

exit 0
