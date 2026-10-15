#!/usr/bin/env bash
# Runs protect-main.sh against throwaway repos: bash .claude/hooks/protect-main.test.sh
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/protect-main.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for name in on-main on-feature; do
  git init -q -b main "$TMP/$name"
  git -C "$TMP/$name" -c user.email=t@t -c user.name=t -c commit.gpgsign=false commit -q --allow-empty -m init
done
git -C "$TMP/on-feature" switch -q -c feature

FAILED=0
check() {
  local want=$1 cwd=$2 cmd=$3 got
  jq -n --arg c "$cmd" --arg d "$cwd" '{tool_input: {command: $c}, cwd: $d}' |
    (cd "$TMP/on-main" && bash "$HOOK") >/dev/null 2>&1
  got=$?
  if [ "$got" -ne "$want" ]; then
    echo "FAIL (want $want, got $got) in ${cwd#"$TMP"/}: $cmd"
    FAILED=1
  fi
}

M=$TMP/on-main
F=$TMP/on-feature

check 0 "$M" "git push origin feature; gh pr create --base main"
check 0 "$M" "git -C $F push -u origin feature"
check 0 "$M" "cd $F && git push -u origin feature"
check 0 "$M" "git push origin HEAD:main"
check 0 "$M" "git branch -D merged-feature"
check 0 "$M" "git status"
check 0 "$M" "git checkout -b new-work"
check 2 "$M" "git reset --hard origin/main"
check 2 "$M" "git clean -fdx"
check 2 "$M" "git checkout ."
check 2 "$M" "git restore ."
check 0 "$F" "git reset --hard origin/main"
check 0 "$M" "git -C $F reset --hard"
check 2 "$F" "git -C $M reset --hard"
check 0 "$M" "cd $F && git clean -fd"
check 2 "$F" "cd $M && git clean -fd"
check 0 "$TMP" "cd on-feature && git reset --hard"
check 2 "$TMP" "cd on-main && git reset --hard"

[ "$FAILED" -eq 0 ] && echo "protect-main: all cases pass"
exit "$FAILED"
