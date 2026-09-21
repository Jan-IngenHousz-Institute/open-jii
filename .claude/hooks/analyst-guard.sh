#!/usr/bin/env bash
# Keeps a session from changing anything outside this checkout, and from reading production
# without the developer opening a window first. Applies to every session and every role: the
# danger is not role-specific, and an engineer session has no more business applying
# infrastructure than an analyst one.
#
# Reads are allowed. Mutations are not, whatever the credentials would permit.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "BLOCKED: the cloud guard needs jq to read the command, and jq is not installed." >&2
  exit 2
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
PROD_MARKER="$ROOT/.claude/analyst-prod.ok"
AUDIT_LOG="$ROOT/.claude/cloud-commands.log"
PROD_WINDOW_SECONDS=7200

# Every guarded CLI, so a mention of one inside an indirection can be refused rather than parsed.
GUARDED='aws|databricks|tofu|terraform|kubectl'

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
[ -z "$COMMAND" ] && exit 0

# The overwhelming majority of commands are `ls`, `git` and `pnpm`, and running six greps and a
# segment loop over each one costs more than the check is worth. One test decides whether any of
# the rest applies.
if ! printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_-])($GUARDED)([^[:alnum:]_-]|$)|analyst-prod\.ok|pnpm[[:space:]]+tf|(AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)|DATABRICKS_(TOKEN|CLIENT_SECRET))="; then
  exit 0
fi

block() {
  echo "BLOCKED: $1" >&2
  echo "This session may read cloud state but never change it. Applies run in CI or in your own terminal. See docs/agents/cloud-access.md." >&2
  exit 2
}

# A shell indirection hides the real command from every check below, so refuse the wrapper and ask
# for the command itself.
if printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_])(eval|xargs)([^[:alnum:]_]|$)" ||
  printf '%s' "$COMMAND" | grep -qE "(bash|sh|zsh)[[:space:]]+-[a-z]*c[[:space:]]" ||
  printf '%s' "$COMMAND" | grep -qE '\$\(|`'; then
  if printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_-])($GUARDED)([^[:alnum:]_-]|$)"; then
    block "a cloud command wrapped in a shell or xargs cannot be checked. Run it directly."
  fi
fi

# Opening the production window is the developer's decision, taken in their own terminal.
if printf '%s' "$COMMAND" | grep -qE 'analyst-prod\.ok'; then
  block "only the developer opens the production window, with pnpm analyst:prod-window."
fi

prod_window_open() {
  [ -f "$PROD_MARKER" ] || return 1
  local age
  age=$(($(date +%s) - $(stat -f %m "$PROD_MARKER" 2>/dev/null || stat -c %Y "$PROD_MARKER")))
  [ "$age" -lt "$PROD_WINDOW_SECONDS" ]
}

# Production is decided on the whole command line, not per segment: `cd infrastructure/env/prod &&
# tofu ...` puts the environment in one segment and the command in the next.
#
# A resource name counts as well as a profile. Every environment-scoped name in this estate carries
# its environment as a suffix, so `--log-group-name /aws/ecs/backend-service-prod` reads production
# whatever profile happens to be active. The separators keep `open-jii-products` out of it.
PROD_TOKEN='(^|[[:space:]=/_-])(prod|production|dr)([-_/.[:space:]]|$)'
if printf '%s' "$COMMAND" | grep -qiE '(--profile|-p|AWS_PROFILE=|DATABRICKS_CONFIG_PROFILE=)[[:space:]=]*[a-z0-9_-]*(prod|production|dr)([^a-z0-9_-]|$)' ||
  printf '%s' "$COMMAND" | grep -qE 'infrastructure/env/(prod|dr)' ||
  printf '%s' "$COMMAND" | grep -qiE "$PROD_TOKEN"; then
  if printf '%s' "$COMMAND" | grep -qE "(^|[^[:alnum:]_-])($GUARDED)([^[:alnum:]_-]|$)"; then
    prod_window_open ||
      block "this targets production. Ask the developer to run pnpm analyst:prod-window first, and to confirm in the conversation."
  fi
fi

# A statement is validated against the whole command, because splitting on separators would take
# the semicolon out of `SELECT 1; DROP TABLE t` and leave a statement that looks like a plain read.
if printf '%s' "$COMMAND" | grep -qE '\-\-statement'; then
  statement=$(printf '%s' "$COMMAND" | sed -nE "s/.*--statement[[:space:]=]+['\"]?(.*)/\1/p" | sed -E "s/['\"][[:space:]]*$//")
  printf '%s' "$statement" | grep -qiE '^[[:space:]]*(select|show|describe|explain|with)[[:space:]]' ||
    block "a statement must start with SELECT, SHOW, DESCRIBE, EXPLAIN or WITH."
  printf '%s' "$statement" | grep -q ';' &&
    block "a statement containing a semicolon can carry a second statement."
fi

if printf '%s' "$COMMAND" | grep -qE '(^|[[:space:]])pnpm[[:space:]]+tf(:[a-z]+)?([[:space:]]|$)'; then
  block "pnpm tf runs an apply."
fi

# Credentials belong to the developer's session, not to a command line. Checked here rather than per
# segment, because normalising a segment strips the leading assignment that this looks for.
if printf '%s' "$COMMAND" | grep -qE '(AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)|DATABRICKS_(TOKEN|CLIENT_SECRET))='; then
  block "credentials do not belong on a command line."
fi

# The tool a segment invokes, found by scanning rather than by assuming it comes first. `env aws`,
# `time aws`, `/usr/local/bin/aws`, `\aws` and a loop body all put something else in position one,
# and every one of those slipped past an earlier version of this hook.
# Quoted text is data rather than a command, so it does not decide whether a segment invokes a CLI.
# Without this, `git commit -m "fix the aws ecs update-service call"` is refused.
mentions_guarded_cli() {
  local bare
  bare=$(printf '%s' "$1" | sed -E "s/\"[^\"]*\"//g; s/'[^']*'//g")
  printf '%s' "$bare" | grep -qE "(^|[[:space:]]|/|\\\\)($GUARDED)([[:space:]]|$)"
}

normalise_segment() {
  local words=() token base out="" found=0
  read -ra words <<<"$1"
  for token in "${words[@]}"; do
    if [ "$found" -eq 0 ]; then
      base="${token##*/}"
      base="${base#\\}"
      case "$base" in
      aws | databricks | tofu | terraform | kubectl)
        found=1
        out="$base"
        ;;
      esac
    else
      out="$out $token"
    fi
  done
  printf '%s' "$out"
}

# Segments, so `describe-x && delete-y` cannot pass on the strength of its first half. A quoted
# separator splits too, which can only cause a false refusal rather than a false pass.
SEGMENTS=$(printf '%s' "$COMMAND" | tr ';|&' '\n' | sed 's/^[[:space:]]*//')

while IFS= read -r segment; do
  [ -z "$segment" ] && continue

  mentions_guarded_cli "$segment" || continue
  segment=$(normalise_segment "$segment")
  [ -z "$segment" ] && continue
  tool=$(printf '%s' "$segment" | awk '{print $1}')

  case "$tool" in
  aws)
    printf '%s' "$segment" | grep -qE '(^|[[:space:]])--(debug|endpoint-url)([[:space:]]|=|$)' &&
      block "--debug and --endpoint-url are not allowed: one prints signing material, the other redirects the call."
    printf '%s' "$segment" | grep -qE '(^|[[:space:]])--cli-input-json([[:space:]]|=|$)' &&
      block "--cli-input-json carries a payload this guard cannot read."

    service=$(printf '%s' "$segment" | awk '{print $2}')
    verb=$(printf '%s' "$segment" | awk '{print $3}')

    case "$service" in
    configure | sso | sso-oidc | iot-data | rds-data | ssm)
      case "$service $verb" in
      "ssm describe-parameters" | "ssm get-parameter" | "ssm get-parameters" | "ssm get-parameters-by-path" | "ssm get-parameter-history") ;;
      *) block "aws $service $verb is not a read this guard allows." ;;
      esac
      ;;
    esac

    case "$verb" in
    get-object | get-secret-value | get-item | batch-get-item | get-records | get-shard-iterator | \
      get-login-password | get-authorization-token | get-thing-shadow | get-credentials-for-identity | \
      get-id | get-session-token | get-federation-token | execute-command | invoke | invoke-async | \
      start-session | send-command | assume-role | assume-role-with-web-identity | start-live-tail | \
      create-export-task | download-db-log-file-portion)
      block "aws $service $verb reads data or mints credentials rather than describing state."
      ;;
    describe-* | list-* | get-* | lookup-* | filter-* | search-* | simulate-* | head-* | ls | tail | \
      start-query | stop-query | batch-get-traces | validate-policy | help)
      : # a read
      ;;
    *) block "aws $service $verb is not a describe, list or get." ;;
    esac

    printf '%s' "$segment" | grep -qE '(^|[[:space:]])--with-decryption([[:space:]]|$)' &&
      block "--with-decryption returns a secret value."

    # A log read without a window and a cap is how a session pulls a month of logs by accident.
    if [ "$service" = "logs" ] && printf '%s' "$verb" | grep -qE 'filter-log-events|get-log-events|start-query|tail'; then
      printf '%s' "$segment" | grep -qE '\-\-(start-time|since)' ||
        block "a log read needs --start-time or --since."
      if printf '%s' "$verb" | grep -qE 'filter-log-events|get-log-events'; then
        limit=$(printf '%s' "$segment" | sed -nE 's/.*--limit[[:space:]=]+([0-9]+).*/\1/p')
        [ -z "$limit" ] && block "a log read needs --limit."
        [ "$limit" -gt 1000 ] && block "--limit $limit is too large; 1000 is the ceiling."
      fi
    fi
    ;;

  databricks)
    group=$(printf '%s' "$segment" | awk '{print $2}')
    action=$(printf '%s' "$segment" | awk '{print $3}')

    case "$group $action" in
    "current-user me" | "auth describe" | "auth profiles" | \
      "jobs list" | "jobs get" | "jobs list-runs" | "jobs get-run" | "jobs get-run-output" | \
      "pipelines list-pipelines" | "pipelines get" | "pipelines list-updates" | "pipelines get-update" | \
      "pipelines list-pipeline-events" | \
      "clusters list" | "clusters get" | "clusters events" | "clusters spark-versions" | \
      "clusters list-node-types" | "warehouses list" | "warehouses get" | \
      "catalogs list" | "catalogs get" | "schemas list" | "schemas get" | "tables list" | \
      "tables get" | "tables exists" | "volumes list" | "volumes get" | \
      "grants get" | "grants get-effective" | "permissions get" | "permissions get-permission-levels" | \
      "workspace list" | "workspace get-status" | "service-principals list" | "groups list" | \
      "secrets list-scopes" | "secrets list-secrets" | "secrets list-acls" | \
      "query-history list" | "queries list" | "queries get" | "system-schemas list" | \
      "fs ls" | "api get" | "bundle validate" | "bundle summary") ;;
    "statement-execution execute-statement") ;; # the statement itself is checked above
    "statement-execution get-statement" | "statement-execution get-statement-result-chunk-n") ;;
    *) block "databricks $group $action is not a read this guard allows." ;;
    esac
    ;;

  tofu | terraform)
    sub=$(printf '%s' "$segment" | awk '{for (i=2; i<=NF; i++) if ($i !~ /^-/) {print $i; exit}}')
    case "$sub" in
    fmt | validate | providers | graph | version | help | "") ;;
    *) block "$tool $sub is not allowed from a session, plan and init included. Applies and plans run in CI or in your own terminal." ;;
    esac
    ;;

  kubectl)
    sub=$(printf '%s' "$segment" | awk '{print $2}')
    case "$sub" in
    get | describe | logs | top | explain | api-resources | api-versions | version | cluster-info) ;;
    config)
      printf '%s' "$segment" | grep -qE 'config[[:space:]]+(get-|current-context|view)' ||
        block "kubectl config may only be read."
      ;;
    *) block "kubectl $sub is not a read." ;;
    esac
    ;;
  esac
done <<<"$SEGMENTS"

printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$(printf '%s' "$INPUT" | jq -r '.session_id // "unknown"')" "$COMMAND" >>"$AUDIT_LOG" 2>/dev/null || true
exit 0
