#!/usr/bin/env bash
# Blocks git commands that throw away local work while the repo they target is on main.
# Pushes are not checked here: GitHub's main ruleset rejects them, with no bypass.
# An accident guard, not a policy boundary. Adapted from mattpocock/skills git-guardrails-claude-code (MIT).
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: protect-main hook skipped because jq is not installed." >&2
  exit 0
fi

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
[ -z "$COMMAND" ] && exit 0
printf '%s' "$COMMAND" | grep -qE 'reset|clean|checkout|restore' || exit 0

DIR=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$DIR" ] && DIR=$PWD

# Splits one shell segment into words, honouring quotes. Never evaluates the command.
tokenize() {
  local s=$1 word="" quote="" ch i q bare
  TOKENS=()
  # Splitting `bash -c 'a && b'` on `&&` leaves each half with one unmatched quote.
  for q in "'" '"'; do
    bare=${s//"$q"/}
    (((${#s} - ${#bare}) % 2)) && s=$bare
  done
  for ((i = 0; i < ${#s}; i++)); do
    ch=${s:i:1}
    if [ -n "$quote" ]; then
      if [ "$ch" = "$quote" ]; then quote=""; else word+=$ch; fi
    elif [ "$ch" = "'" ] || [ "$ch" = '"' ]; then
      quote=$ch
    elif [[ $ch =~ [[:space:]] ]]; then
      [ -n "$word" ] && TOKENS+=("$word")
      word=""
    else
      word+=$ch
    fi
  done
  [ -n "$word" ] && TOKENS+=("$word")
}

resolve() {
  case "$2" in
    "~"*) printf '%s' "$HOME${2#\~}" ;;
    /*) printf '%s' "$2" ;;
    *) printf '%s' "$1/$2" ;;
  esac
}

on_main() {
  local branch
  branch=$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_INDEX_FILE \
    -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES -u GIT_PREFIX \
    git "$@" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  [ "$branch" = "main" ]
}

block() {
  echo "BLOCKED: $1 is on main and this discards local work." >&2
  echo "Switch to a branch first; on your own branches nothing is restricted." >&2
  exit 2
}

# Each segment of `a && b; c | d`, and the inside of `bash -c '...'` or `( ... )`, is judged
# by the directory it runs in: the latest `cd`, then its own `git -C`.
while IFS= read -r SEGMENT; do
  tokenize "$SEGMENT"
  set -- "${TOKENS[@]+"${TOKENS[@]}"}"
  while [ $# -gt 0 ]; do
    case "$1" in
      -c | -lc)
        if [[ ${2:-} =~ [[:space:]] ]]; then
          tokenize "$2"
          set -- "${TOKENS[@]}"
        else
          shift
        fi
        ;;
      "(" | "{" | "!" | bash | sh | zsh | env | command | exec | sudo) shift ;;
      "("* | "{"*) set -- "${1:1}" "${@:2}" ;;
      *) break ;;
    esac
  done
  [ $# -eq 0 ] && continue
  if [ "$1" = cd ] && [ $# -ge 2 ]; then
    DIR=$(resolve "$DIR" "${2%)}")
    continue
  fi
  [ "$1" = git ] || continue
  shift
  TARGET=$DIR
  GIT_ARGS=()
  while [ $# -gt 0 ]; do
    case "$1" in
      -C) TARGET=$(resolve "$TARGET" "${2:-.}"); shift 2 ;;
      -c) shift 2 ;;
      --git-dir=* | --work-tree=*) GIT_ARGS+=("$1"); shift ;;
      --git-dir | --work-tree) GIT_ARGS+=("$1=${2:-}"); shift 2 ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  [ $# -eq 0 ] && continue
  SUB=$1
  shift
  ARGS=" ${*%)} "
  case "$SUB" in
    reset) [[ $ARGS == *" --hard "* ]] || continue ;;
    clean) [[ $ARGS =~ [[:space:]](--force|-[A-Za-z]*f[A-Za-z]*)[[:space:]] ]] || continue ;;
    checkout) [[ $ARGS == *" . "* ]] || continue ;;
    restore)
      [[ $ARGS == *" . "* ]] || continue
      [[ $ARGS == *" --staged "* && $ARGS != *" --worktree "* && $ARGS != *" -W "* ]] && continue
      ;;
    *) continue ;;
  esac
  on_main -C "$TARGET" "${GIT_ARGS[@]+"${GIT_ARGS[@]}"}" && block "$TARGET"
done < <(printf '%s\n' "$COMMAND" | sed -E 's/(&&|\|\||;|\|)/\n/g')

exit 0
