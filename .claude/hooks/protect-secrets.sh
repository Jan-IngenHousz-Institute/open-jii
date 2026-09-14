#!/usr/bin/env bash
# Keeps secrets out of the agent's context and publishing out of its hands.
# The tool that needs a secret reads it itself (each app loads its own .env; the devkit resolves the
# Linear key from the keychain; curl reads the session header file with -H @file). A person runs
# releases. .env.example, .env.default and .env.test hold no secrets and stay readable.
# Claude Code's own deny rules in .claude/settings.json are the first layer; this hook catches what
# they cannot see: a file read without naming it, python open(), cp, source, and publishing.
set -uo pipefail

# Fields arrive one per line. A multi-line command is flattened to one line, which is all the
# matching below needs. Node is required by this repo; jq is the fallback.
read_fields() {
  if command -v node >/dev/null 2>&1; then
    node -e '
      let data = "";
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => {
        const input = JSON.parse(data);
        const flat = (value) => String(value ?? "").replace(/[\r\n]+/g, " ");
        const toolInput = input.tool_input || {};
        process.stdout.write([flat(input.tool_name), flat(toolInput.command), flat(toolInput.file_path)].join("\n"));
      });
    '
  elif command -v jq >/dev/null 2>&1; then
    jq -r '[(.tool_name // ""), ((.tool_input.command // "") | gsub("[\r\n]+"; " ")), (.tool_input.file_path // "")] | .[]'
  else
    return 1
  fi
}

block() {
  echo "BLOCKED: $1" >&2
  echo "Secrets stay out of the context window and a person runs releases. The tool that needs a secret reads it itself: pnpm linear:auth and linear:query for Linear, curl -H @.claude/session.header for the local API, the app's own config loading for the rest. See AGENTS.md, Secrets." >&2
  exit 2
}

INPUT=$(cat)
if ! FIELDS=$(printf '%s' "$INPUT" | read_fields); then
  block "the tool input cannot be parsed because neither node nor jq is available."
fi
TOOL=$(printf '%s\n' "$FIELDS" | sed -n '1p')
COMMAND=$(printf '%s\n' "$FIELDS" | sed -n '2p')
FILE=$(printf '%s\n' "$FIELDS" | sed -n '3p')

# A path may start the string or follow a slash, whitespace, a quote, = or @.
START="(^|[[:space:]/'\"=@])"
# Gitignored env files: .env, .env.local, .env.development.local, .env.test.local, .env.production.local.
ENV_FILE="${START}\.env(\.local|\.development\.local|\.test\.local|\.production(\.local)?)?"
# Playwright auth state, device certificates, and the session header pnpm local:login writes.
AUTH_STATE="${START}\.auth/[^[:space:]'\"]+\.json"
CERT_FILE='\.(pem|p12|pfx)'
SESSION_HEADER="${START}\.claude/session\.header"
ANY_SECRET="(${ENV_FILE}|${AUTH_STATE}|${CERT_FILE}|${SESSION_HEADER})"
TERMINATOR="([[:space:]'\"|;&)]|\$)"
READ_VERBS='cat|less|more|head|tail|grep|rg|egrep|fgrep|sed|awk|cut|sort|uniq|wc|tee|od|xxd|hexdump|strings|base64|diff|cmp|pbcopy|xargs|scp|rsync|python3?|node|ruby|perl|php|vi|vim|nano|code|open'

mentions() {
  printf '%s' "$COMMAND" | grep -qE -e "$1"
}

is_secret_path() {
  printf '%s' "$1" | grep -qE "${ANY_SECRET}\$"
}

if [ "$TOOL" = "Read" ]; then
  if is_secret_path "$FILE"; then
    block "this reads a secrets file."
  fi
  exit 0
fi

[ "$TOOL" = "Bash" ] || exit 0
[ -z "$COMMAND" ] && exit 0

# Publishing a build or an OTA update reaches real users; a person runs it. Local builds stay allowed.
for pattern in \
  '(^|[[:space:]|;&(])(npx[[:space:]]+)?(eas|eas-cli)[[:space:]]+(update|submit)([[:space:]]|$)' \
  '(^|[[:space:]])--auto-submit' \
  '(^|[[:space:]|;&(])(pnpm|npm|yarn)[^|;&]*(update:(preview|internal|beta|production)|submit-to-google-play)([[:space:]]|$)'; do
  if mentions "$pattern"; then
    block "this publishes a build or an OTA update."
  fi
done

mentions "${ANY_SECRET}${TERMINATOR}" || exit 0

# The command names a secret file. Reading, sourcing, uploading or copying it elsewhere is what gets
# stopped; ls, chmod, rm, stat, git check-ignore and curl -H @session.header stay allowed.
if mentions "(^|[[:space:]|;&(])(${READ_VERBS})[[:space:]]"; then
  block "this reads a secrets file."
fi
if mentions "(^|[[:space:]|;&(])(source|\.)[[:space:]]" || mentions 'set[[:space:]]+-a'; then
  block "this sources a secrets file into the shell."
fi
if mentions "<[[:space:]]*[^[:space:]]*${ANY_SECRET}"; then
  block "this reads a secrets file through a redirect."
fi
if mentions "(^|[[:space:]|;&(])curl[[:space:]]" && mentions "(${ENV_FILE}|${AUTH_STATE}|${CERT_FILE})${TERMINATOR}"; then
  block "this sends a secrets file somewhere."
fi

# cp is allowed only from an env file to another env file, which is how a worktree gets its env.
if mentions "(^|[[:space:]|;&(])cp[[:space:]]"; then
  CP_ARGS=$(printf '%s' "$COMMAND" | sed -E 's/.*(^|[[:space:]|;&(])cp[[:space:]]+//; s/[|;&].*$//')
  set -f
  # shellcheck disable=SC2086
  set -- $CP_ARGS
  LAST=""
  for word in "$@"; do LAST=$word; done
  for word in "$@"; do
    [ "$word" = "$LAST" ] && break
    if is_secret_path "$word" && ! printf '%s' "$LAST" | grep -qE "${ENV_FILE}\$"; then
      block "this copies a secrets file somewhere that is not an env file."
    fi
  done
fi

exit 0
