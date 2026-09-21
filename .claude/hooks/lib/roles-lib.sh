#!/usr/bin/env bash
# Shared helpers for the role hooks. Sourced, not executed.

# Per-session state, in the same place and shape as the docs reminder's marker.
openjii_state_dir() {
  local session_id="$1"
  local base="${TMPDIR:-/tmp}/openjii-roles"
  printf '%s/%s' "$base" "$session_id"
}

openjii_session_id() {
  printf '%s' "$1" | jq -r '.session_id // empty' | tr -cd '[:alnum:]_-'
}

# Counts turns the developer actually typed. Tool results arrive as `user` lines too, and a
# compaction summary is injected as one, so counting `type == "user"` alone overstates it by an
# order of magnitude.
openjii_developer_turns() {
  local transcript="$1"
  [ -n "$transcript" ] && [ -f "$transcript" ] || {
    printf '0'
    return
  }
  jq -s '
    [ .[]
      | select(.type == "user")
      | select((.isMeta // false) == false)
      | select((.isCompactSummary // false) == false)
      | select(
          (.message.content | type) == "string"
          or ((.message.content | type) == "array"
              and ((.message.content[0].type // "") != "tool_result"))
        )
    ] | length' "$transcript" 2>/dev/null || printf '0'
}

openjii_compactions() {
  local transcript="$1"
  [ -n "$transcript" ] && [ -f "$transcript" ] || {
    printf '0'
    return
  }
  jq -s '[ .[] | select((.isCompactSummary // false) == true) ] | length' "$transcript" 2>/dev/null ||
    printf '0'
}

# A role only gets suggested when its skill is actually present, so the router can carry the full
# map while the roles are still landing one at a time.
openjii_known_role() {
  local root="$1" role="$2"
  [ -f "$root/.agents/skills/openjii-role-$role/SKILL.md" ]
}

openjii_emit_context() {
  jq -n --arg context "$1" \
    '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $context}}'
}

# Roles are an offer, not a policy. A developer who does not want them turns them off once and is
# never prompted again. This covers the role suggestion and the drift note only; the cloud guard is
# a safety mechanism and has no opt-out.
openjii_roles_enabled() {
  local root="$1"
  [ "${OPENJII_ROLES:-}" = "off" ] && return 1
  [ -e "$root/.claude/roles-off" ] && return 1
  return 0
}
