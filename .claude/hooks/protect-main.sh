#!/usr/bin/env bash
# Blocks destructive git while on main, and blocks pushing to main from anywhere.
# Feature branches are deliberately unrestricted.
# Adapted from mattpocock/skills git-guardrails-claude-code (MIT).
set -uo pipefail

# Node is required by this repo; jq is the fallback. Without either, the hook cannot see the
# command and steps aside with a warning, as it always has.
read_command() {
  if command -v node >/dev/null 2>&1; then
    node -e '
      let data = "";
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => {
        const input = JSON.parse(data);
        const command = input.tool_input && input.tool_input.command;
        process.stdout.write(String(command ?? "").replace(/[\r\n]+/g, " "));
      });
    '
  elif command -v jq >/dev/null 2>&1; then
    jq -r '(.tool_input.command // "") | gsub("[\r\n]+"; " ")'
  else
    return 1
  fi
}

INPUT=$(cat)
if ! COMMAND=$(printf '%s' "$INPUT" | read_command); then
  echo "WARNING: protect-main hook skipped because neither node nor jq is available." >&2
  exit 0
fi
[ -z "$COMMAND" ] && exit 0

block() {
  echo "BLOCKED: $1" >&2
  echo "main is protected in this repo. Work on a branch and open a PR. Anything goes on your own branches." >&2
  exit 2
}

# Pushing to main from any branch, including short and fully qualified refspecs.
if printf '%s' "$COMMAND" | grep -qE 'git[[:space:]]+push' &&
  printf '%s' "$COMMAND" | grep -qE '(^|[[:space:]:])(refs/heads/)?main([[:space:]]|$)'; then
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
