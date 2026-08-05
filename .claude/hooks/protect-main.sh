#!/usr/bin/env bash
# Blocks destructive git while on main, and blocks pushing to main from anywhere.
# Feature branches are deliberately unrestricted.
# Adapted from mattpocock/skills git-guardrails-claude-code (MIT).
set -uo pipefail

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
[ -z "$COMMAND" ] && exit 0

block() {
  echo "BLOCKED: $1" >&2
  echo "main is protected in this repo. Work on a branch and open a PR. Anything goes on your own branches." >&2
  exit 2
}

# Pushing to main from any branch, e.g. `git push origin main` or `git push origin HEAD:main`.
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+push' &&
  printf '%s' "$COMMAND" | grep -qE '(^|[[:space:]:])main([[:space:]]|$)'; then
  block "this pushes to main."
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$BRANCH" = "main" ] || exit 0

for pattern in \
  'git[[:space:]]+push' \
  'reset[[:space:]]+--hard' \
  'git[[:space:]]+clean[[:space:]]+-[A-Za-z]*f' \
  'git[[:space:]]+branch[[:space:]]+-D' \
  'git[[:space:]]+checkout[[:space:]]+\.' \
  'git[[:space:]]+restore[[:space:]]+\.' \
  'push[[:space:]]+--force'; do
  if printf '%s' "$COMMAND" | grep -qE "$pattern"; then
    block "you are on main and this is destructive."
  fi
done

exit 0
