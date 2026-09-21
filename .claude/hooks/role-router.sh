#!/usr/bin/env bash
# Suggests a role on the first developer turn, and nudges once the session has drifted past the
# program it was started for. Always exits 0: a non-zero exit here would discard the prompt.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: role router hook skipped because jq is not installed." >&2
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
# shellcheck source=/dev/null
. "$ROOT/.claude/hooks/lib/roles-lib.sh"

INPUT=$(cat)
openjii_roles_enabled "$ROOT" || exit 0
PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty')
SESSION_ID=$(openjii_session_id "$INPUT")
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')
[ -z "$SESSION_ID" ] && exit 0

STATE_DIR=$(openjii_state_dir "$SESSION_ID")
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0

# Past the first turn, the only job left is the drift nudge.
if [ -e "$STATE_DIR/routed" ]; then
  # Counting means reading the whole transcript, which grows all session. Once every nudge has
  # fired there is nothing left to learn from it, so stop paying for the count.
  if [ -e "$STATE_DIR/drift-30" ] && [ -e "$STATE_DIR/drift-60" ] && [ -e "$STATE_DIR/drift-compact" ]; then
    exit 0
  fi

  ROLE=$([ -f "$STATE_DIR/role" ] && cat "$STATE_DIR/role" || echo "the role it started in")
  TURNS=$(openjii_developer_turns "$TRANSCRIPT")
  COMPACTIONS=$(openjii_compactions "$TRANSCRIPT")

  for threshold in 30 60; do
    if [ "$TURNS" -ge "$threshold" ] && [ ! -e "$STATE_DIR/drift-$threshold" ]; then
      touch "$STATE_DIR/drift-$threshold"
      openjii_emit_context "For information: this session is $TURNS developer turns in. If the current request has become a different undertaking from the one it started as ($ROLE), a fresh session would have cleaner context, and mentioning that in one line is worth doing. If the work is still the same thread, ignore this. Either way, carry on with what was asked."
      exit 0
    fi
  done

  if [ "$COMPACTIONS" -ge 2 ] && [ ! -e "$STATE_DIR/drift-compact" ]; then
    touch "$STATE_DIR/drift-compact"
    openjii_emit_context "For information: this session has been compacted $COMPACTIONS times, so most of its early context is now a summary. If the work has moved on from what it started as ($ROLE), say so in one line and offer a handoff. If not, ignore this and carry on."
  fi
  exit 0
fi

# An explicit role command needs no suggestion, only recording, so a resumed session can be told
# which role it is in.
NAMED=$(printf '%s' "$PROMPT" | grep -oE '/openjii-role-[a-z-]+' | head -1 | sed 's|/openjii-role-||')
if [ -n "$NAMED" ]; then
  touch "$STATE_DIR/routed"
  printf '%s' "$NAMED" >"$STATE_DIR/role"
  exit 0
fi

# Some other slash command: stay out of the way, and leave the next real prompt to be routed.
case "$PROMPT" in
/*) exit 0 ;;
esac

LINES=$(printf '%s\n' "$PROMPT" | wc -l | tr -d ' ')
LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

# The order is the classifier. Each pattern is checked against the lower-cased prompt, and the
# first match wins, so the more specific signals come before the broader ones.
ERROR_WALL='Error:|Exception|Traceback|error TS[0-9]|TS[0-9]{4}:|FAIL |ELIFECYCLE|npm ERR!|panic:|Caused by:|at .+\(.+:[0-9]+:[0-9]+\)'
TICKET='ojd-[0-9]+'
DESIGN_WORK='refine|ticket shape|granular|backlog|design a project|new project|conceptualis|roadmap|split into tickets|what should we build'
REVIEW='(review|audit|look over|second pair of eyes).*(pr|diff|branch|#[0-9]+)'
RELEASE='cut a release|release for|release notes|changelog|force update|version bump|promote to prod'
DOCUMENTATION='docs? page|documentation|user guide|screenshots?|glossary'
RUNNING_SYSTEM='in production|on prod|prod is|production right now|databricks|cloudwatch|lambda|opennext|ecs task|(^|[[:space:]])aws[[:space:]]|overnight'
VISUAL='(^|[[:space:]])ui([[:space:]]|$)|ux|shadcn|design scheme|layout|responsive|looks? (cramped|wrong|off|bad)|cramped|spacing|overlap|narrow screen|dark mode|colour|color|visual'
BUILD='(^|[[:space:]])(add|implement|build|create|support|migrate|refactor|rename|wire up|hook up|expose|extend)[[:space:]]'
QUESTION='^(what|which|where|who|why|how|does|do|is|are|can)[[:space:]]'

candidate="generalist"
if [ "$LINES" -ge 3 ] && printf '%s' "$PROMPT" | grep -qE "$ERROR_WALL"; then
  candidate="triage"
elif printf '%s' "$LOWER" | grep -qE "$TICKET" && printf '%s' "$LOWER" | grep -qE "$DESIGN_WORK"; then
  candidate="pm"
elif printf '%s' "$LOWER" | grep -qE "$TICKET"; then
  candidate="engineer"
elif printf '%s' "$LOWER" | grep -qE "$REVIEW"; then
  candidate="reviewer"
elif printf '%s' "$LOWER" | grep -qE "$RELEASE"; then
  candidate="release-manager"
elif printf '%s' "$LOWER" | grep -qE "$DESIGN_WORK"; then
  candidate="pm"
elif printf '%s' "$LOWER" | grep -qE "$DOCUMENTATION"; then
  candidate="docs-writer"
elif printf '%s' "$LOWER" | grep -qE "$RUNNING_SYSTEM"; then
  candidate="analyst"
elif printf '%s' "$LOWER" | grep -qE "$BUILD"; then
  candidate="engineer"
elif printf '%s' "$LOWER" | grep -qE "$VISUAL"; then
  candidate="designer"
elif [ "$(printf '%s' "$PROMPT" | wc -w | tr -d ' ')" -le 25 ] &&
  { printf '%s' "$PROMPT" | grep -qE '\?' || printf '%s' "$LOWER" | grep -qE "$QUESTION"; }; then
  candidate="butler"
fi

# What the prompt looked like, kept separately from what was suggested, so a role still being
# written shows up as a fallback rather than as a misread prompt.
printf '%s' "$candidate" >"$STATE_DIR/candidate"
openjii_known_role "$ROOT" "$candidate" || candidate="generalist"
touch "$STATE_DIR/routed"
printf '%s' "$candidate" >"$STATE_DIR/role"

openjii_emit_context "Optional: this request looks like $candidate work, and .agents/skills/openjii-role-$candidate/SKILL.md is a short brief on how that is done here. Reading it is usually worth the tokens, but it is a suggestion and not an instruction: a different role, or none at all, is fine. If you do take one, say which in one line. This will not be suggested again in this session."
exit 0
