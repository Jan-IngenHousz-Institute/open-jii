#!/usr/bin/env bash
# Tells a fresh session that no role is active, and reminds a resumed one which role it had.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: role session-start hook skipped because jq is not installed." >&2
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
# shellcheck source=/dev/null
. "$ROOT/.claude/hooks/lib/roles-lib.sh"

INPUT=$(cat)
openjii_roles_enabled "$ROOT" || exit 0
SOURCE=$(printf '%s' "$INPUT" | jq -r '.source // empty')
SESSION_ID=$(openjii_session_id "$INPUT")
[ -z "$SESSION_ID" ] && exit 0
STATE_DIR=$(openjii_state_dir "$SESSION_ID")

case "$SOURCE" in
resume | compact)
  # Re-attached skills share a token budget after a compaction, so a role can quietly fall out of
  # context. Naming it is cheaper than the session carrying on without it.
  [ -f "$STATE_DIR/role" ] || exit 0
  ROLE=$(cat "$STATE_DIR/role")
  printf 'This session is working in the %s role. If %s is no longer in context, read %s again.\n' \
    "$ROLE" "openjii-role-$ROLE" ".agents/skills/openjii-role-$ROLE/SKILL.md"
  exit 0
  ;;
esac

cat <<'EOF'
This repo has optional roles a session can work in. They are a shortcut, not a rule: taking one
loads a short brief about what that kind of work involves here. Working without one is perfectly
fine, and nothing will ask again after this message.

If one of these fits what the developer asks for, read its skill and follow it. Invoke it as
/openjii-role-<name>, or just carry on without one.

  generalist  a question about the repo, a first look around, or a small contained change
  butler      one factual lookup: a command, a path, a flag, what something is set to
  triage      a pasted error, a failing build or a failing test
  engineer    implementing a ticket or a problem, with a scope
  reviewer    an adversarial multi-pass review of a diff
  designer    how a screen should look and behave, and building the front end of it
  pm          deciding what to build, then writing it up as a project and tickets
  analyst     what a running environment is actually doing: logs, metrics, tables, a device

If you take one, say which in one line so the developer can redirect you. To switch the whole thing
off on this machine: touch .claude/roles-off, or set OPENJII_ROLES=off.
EOF
