#!/usr/bin/env bash
# Runs the cloud guard in analyst-guard.mjs. A command that mentions no cloud tool, secret file or
# production window leaves here, so ordinary commands do not pay for starting node. Without node the
# guard cannot read a command, so it refuses rather than let a cloud command through unchecked.
INPUT=$(cat)

# The same trigger as TRIGGER in analyst-guard.mjs, matched with quotes and escapes removed.
if ! printf '%s' "$INPUT" | grep -qF "\$'" && ! printf '%s' "$INPUT" | tr -d "'\"\\\\" |
  grep -qiE 'aws|databricks|tofu|terraform|kubectl|analyst|tf|AWS_|DATABRICKS_|\.env|tfvars|tfstate|credentials|databrickscfg'; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "BLOCKED: the cloud guard needs node to read the command, and node is not on PATH." >&2
  exit 2
fi
printf '%s' "$INPUT" | exec node "$(dirname "${BASH_SOURCE[0]}")/analyst-guard.mjs"
