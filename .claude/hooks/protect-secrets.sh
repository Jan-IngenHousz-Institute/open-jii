#!/usr/bin/env bash
# Keeps secrets out of the agent's context and publishing out of its hands.
# The tool that needs a secret reads it itself (each app loads its own .env; the devkit resolves the
# Linear key from the keychain; curl reads the session header file with -H @file). A person runs
# releases. .env.example, .env.default and .env.test hold no secrets and stay readable.
# Claude Code's own deny rules in .claude/settings.json are the first layer; this hook catches what
# they cannot see: reads that do not name the file (recursive grep, find -exec, inline scripts),
# python open(), cp, mv, tar, git, source, uploads, the keychain, the clipboard, the environment,
# and publishing. It matches command text, so it raises the bar; it is not a sandbox.
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
        const fields = [input.tool_name, toolInput.command, toolInput.file_path, toolInput.path, toolInput.glob];
        process.stdout.write(fields.map(flat).join("\n"));
      });
    '
  elif command -v jq >/dev/null 2>&1; then
    jq -r '[(.tool_name // ""), ((.tool_input.command // "") | gsub("[\r\n]+"; " ")), (.tool_input.file_path // ""), (.tool_input.path // ""), (.tool_input.glob // "")] | .[]'
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
SEARCH_PATH=$(printf '%s\n' "$FIELDS" | sed -n '4p')
SEARCH_GLOB=$(printf '%s\n' "$FIELDS" | sed -n '5p')

# A path may start the string or follow a slash, whitespace, a quote, =, @, : or a glob character.
START="(^|[[:space:]/'\"=@:*?])"
# A command word may start the string or follow a pipe, a separator, a paren, a quote or a backtick.
SEP="(^|[[:space:]|;&('\"\`])"
# Gitignored env files: .env, .envrc, .env.local, .env.*.local, .env.production.
ENV_FILE="${START}\.env(rc|\.local|\.development\.local|\.test\.local|\.production(\.local)?)?"
# Playwright auth state, device certificates, and the session header pnpm local:login writes.
AUTH_STATE="${START}\.auth/[^[:space:]'\"]+\.json"
CERT_FILE='\.(pem|p12|pfx)'
SESSION_HEADER="${START}\.claude/session\.header"
# The developer's own credential files, however the home directory is spelled.
HOME_DIR="(~|\\\$HOME|/Users/[^/[:space:]'\"]+|/home/[^/[:space:]'\"]+)"
HOME_SECRET="${HOME_DIR}/(\.ssh(/[^[:space:]'\"]*)?|\.aws(/[^[:space:]'\"]*)?|\.gnupg(/[^[:space:]'\"]*)?|\.claude/projects/[^[:space:]'\"]*\.jsonl|\.netrc|\.config/gh/hosts\.yml|\.expo/state\.json|\.databrickscfg|\.docker/config\.json|\.npmrc|\.kube/config|\.claude/\.credentials\.json)"
ANY_SECRET="(${ENV_FILE}|${AUTH_STATE}|${CERT_FILE}|${SESSION_HEADER}|${HOME_SECRET})"
TERMINATOR="([[:space:]'\"|;&)]|\$)"
READ_VERBS='cat|less|more|head|tail|grep|rg|ag|egrep|fgrep|sed|awk|cut|sort|uniq|wc|tee|od|xxd|hexdump|strings|base64|diff|cmp|pbcopy|xargs|scp|rsync|python3?|node|ruby|perl|php|vi|vim|nano|code|open'
PACK_VERBS='mv|ln|install|tar|zip|gzip|bzip2|xz|zstd|7z|7za|dd|split|shred'
NET_VERBS='curl|wget|nc|ncat|socat|ssh|sftp|ftp|aws|gh|http|xh|openssl|gsutil|az|gcloud'
GIT_READS='add|diff|show|grep|cat-file|hash-object|update-index|stash|archive|apply|am|blame|annotate|bundle|format-patch'

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

# The Grep tool searches file contents; pointed at a secrets file it prints the matching line.
if [ "$TOOL" = "Grep" ]; then
  if is_secret_path "$SEARCH_PATH"; then
    block "this searches inside a secrets file."
  fi
  if printf '%s' "$SEARCH_GLOB" | grep -qE '\.env|\.auth|\.(pem|p12|pfx)|session\.header|\.netrc|\.ssh|hosts\.yml|credentials'; then
    block "this searches inside secrets files."
  fi
  exit 0
fi

[ "$TOOL" = "Bash" ] || exit 0
[ -z "$COMMAND" ] && exit 0

# Publishing a build or an OTA update reaches real users; a person runs it. Local builds stay allowed.
for pattern in \
  "${SEP}(npx[[:space:]]+)?(eas|eas-cli)[[:space:]]+(update|submit)([[:space:]]|\$)" \
  '(^|[[:space:]])--auto-submit' \
  "${SEP}(pnpm|npm|yarn)[^|;&]*(update:(preview|internal|beta|production)|submit-to-google-play)([[:space:]]|\$)"; do
  if mentions "$pattern"; then
    block "this publishes a build or an OTA update."
  fi
done

# The keychain, the clipboard and the environment are the other places a credential sits. The
# devkit reads the keychain in-process; the one clipboard use is piping a pasted key into
# pnpm linear:auth; the session cookie only ever travels as a file, to the local backend.
KEYCHAIN="${SEP}(security[[:space:]]+(find-generic-password|find-internet-password|add-generic-password|add-internet-password|dump-keychain|export)|secret-tool[[:space:]]+(lookup|search|store))([[:space:]]|\$)"
CLIPBOARD="${SEP}(pbpaste|wl-paste|xclip|xsel)([[:space:]]|\$)"
CLIPBOARD_TO_AUTH='^[[:space:]]*(pbpaste|wl-paste|xclip[^|]*|xsel[^|]*)[[:space:]]*\|[[:space:]]*pnpm[[:space:]]+linear:auth([[:space:]]+--file)?[[:space:]]*$'
ENV_DUMP="${SEP}(env|printenv|set|(export|declare|typeset)([[:space:]]+-[px])?)[[:space:]]*(\$|[|;&>)'\"])"
SECRET_VAR='([A-Z0-9_]*(API_KEY|ACCESS_KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIALS|DSN)[A-Z0-9_]*|DATABASE_URL|DB_URL|REDIS_URL)'
SECRET_VAR_USE='(\$\{?'"${SECRET_VAR}"'|printenv[[:space:]]+'"${SECRET_VAR}"'|'"${SEP}"'(export[[:space:]]+)?'"${SECRET_VAR}"'=[^[:space:]])'
# Inline scripts get the same treatment; a code search for process.env is not an interpreter call.
INTERPRETER="${SEP}(node|tsx|bun|deno|python3?|ruby|perl|php)[[:space:]]"
INLINE_ENV_DUMP='(process\.env|os\.environ)([^A-Za-z0-9_.[]|$)'
INLINE_SECRET_READ='(process\.env(\.|\[[^A-Za-z0-9_]{0,3})|os\.environ(\[|\.get\()[^A-Za-z0-9_]{0,3}|getenv\([^A-Za-z0-9_]{0,3})'"${SECRET_VAR}"

if mentions "$KEYCHAIN"; then
  block "this reads or writes the OS keychain; pnpm linear:auth and pnpm linear:query do that in-process."
fi
if mentions "$CLIPBOARD" && ! mentions "$CLIPBOARD_TO_AUTH"; then
  block "this reads the clipboard; the one allowed form is: pbpaste | pnpm linear:auth"
fi
if mentions "$ENV_DUMP"; then
  block "this dumps the environment."
fi
if mentions "$SECRET_VAR_USE"; then
  block "this prints a credential variable or puts one on the command line."
fi
if mentions "$INTERPRETER" && { mentions "$INLINE_ENV_DUMP" || mentions "$INLINE_SECRET_READ"; }; then
  block "this reads the environment from an inline script."
fi
if mentions '(local:login|commands/login\.ts)[^|;&]*[[:space:]]--print([[:space:]]|$)'; then
  block "this prints the session cookie; pnpm local:login writes .claude/session.header instead."
fi
if mentions "${SEP}E2E_ALLOW_UNSAFE_DATABASE="; then
  block "this lifts the loopback-only guard on the sign-in code reader; the e2e fixtures set it in CI, an agent does not."
fi
if mentions "${SEP}curl[[:space:]]" && mentions "$SESSION_HEADER"; then
  HOSTS=$(printf '%s' "$COMMAND" | grep -oE "https?://[^/[:space:]'\"?#]+" | sed -E 's#^https?://##; s#:[0-9]+$##')
  [ -n "$HOSTS" ] || block "this uses the local session without a literal 127.0.0.1 URL."
  for host in $HOSTS; do
    case "$host" in
      localhost | 127.0.0.1 | '[::1]') ;;
      *) block "this sends the local session to $host; it is only for the local backend." ;;
    esac
  done
fi

# A recursive search walks into gitignored env files. rg, git grep and the Grep tool skip them.
if mentions "${SEP}(grep|egrep|fgrep)([[:space:]][^|;&]*)?[[:space:]](-[A-Za-z]*[rR][A-Za-z]*|--recursive|--dereference-recursive)([[:space:]]|\$)"; then
  block "recursive grep reads gitignored env files; use rg, git grep, or the Grep tool."
fi
if mentions "${SEP}(rg|ag)([[:space:]][^|;&]*)?[[:space:]](-[A-Za-z]*u[A-Za-z]*|--no-ignore[A-Za-z-]*|--unrestricted)([[:space:]]|\$)"; then
  block "this search ignores .gitignore and so reads env files."
fi
if mentions "${SEP}find[[:space:]][^|;&]*-(exec|execdir|ok|okdir)[[:space:]]+(${READ_VERBS})([[:space:]]|\$)"; then
  block "find -exec with a reader walks into secrets files; use rg, git grep, or the Grep tool."
fi

mentions "${ANY_SECRET}${TERMINATOR}" || exit 0

# The command names a secret file. Reading, sourcing, uploading, staging, moving or copying it
# elsewhere is what gets stopped; ls, chmod, rm, stat, git check-ignore and curl -H @session.header
# to the local backend stay allowed.
if mentions "${SEP}(${READ_VERBS})[[:space:]]"; then
  block "this reads a secrets file."
fi
if mentions "${SEP}(source|\.)[[:space:]]" || mentions 'set[[:space:]]+-a'; then
  block "this sources a secrets file into the shell."
fi
if mentions "<[[:space:]]*[^[:space:]]*${ANY_SECRET}"; then
  block "this reads a secrets file through a redirect."
fi
if mentions "${SEP}(${NET_VERBS})[[:space:]]"; then
  if mentions "(${ENV_FILE}|${AUTH_STATE}|${CERT_FILE}|${HOME_SECRET})${TERMINATOR}"; then
    block "this sends a secrets file somewhere."
  fi
  if ! mentions "${SEP}curl[[:space:]]"; then
    block "this sends the local session somewhere; only curl -H @.claude/session.header to 127.0.0.1 is allowed."
  fi
fi
if mentions "${SEP}git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(${GIT_READS})([[:space:]]|\$)"; then
  block "this would read or stage a secrets file through git."
fi
if mentions "${SEP}(${PACK_VERBS})[[:space:]]"; then
  block "this moves, links or packs a secrets file."
fi

# cp is allowed only from an env file to another env file, which is how a worktree gets its env.
# Every cp in the command is checked, not only the last one.
check_cp() {
  local last="" word
  set -f
  # shellcheck disable=SC2086
  set -- $1
  for word in "$@"; do last=$word; done
  for word in "$@"; do
    [ "$word" = "$last" ] && break
    word=${word//[\"\']/}
    if is_secret_path "$word" && ! printf '%s' "${last//[\"\']/}" | grep -qE "${ENV_FILE}\$"; then
      block "this copies a secrets file somewhere that is not an env file."
    fi
  done
}

if mentions "${SEP}cp[[:space:]]"; then
  while IFS= read -r segment; do
    segment=$(printf '%s' "$segment" | sed -E 's/^[[:space:]()]+//; s/^(sudo|command|exec|nohup|time)[[:space:]]+//')
    case "$segment" in
      cp\ *) check_cp "${segment#cp }" ;;
    esac
  done <<<"$(printf '%s' "$COMMAND" | tr '|;&' '\n')"
fi

exit 0
