#!/usr/bin/env bash
#
# Tear down IoT things + shared cert created by provision-iot-things.sh.
# Order matters: IoT won't delete a cert that is ACTIVE or still has a
# policy/thing attached, so we detach + deactivate first.
#
# Usage:
#   ./teardown-iot-things.sh -c CERT_ARN -f things.txt -r REGION [--profile P] \
#                            -p POLICY [-p POLICY ...]
#
#   -c CERT_ARN    ARN of the shared cert (from iot-certs/provisioning-summary.csv)
#   -f FILE        Thing names, one per line
#   -p POLICY      Policy attached to the cert (repeatable) so we can detach it
#   -r REGION      AWS region
#   --profile P    AWS CLI profile
#   -n             Dry run

set -euo pipefail

CERT_ARN=""
THINGS_FILE=""
POLICIES=()
REGION=""
PROFILE=""
DRY_RUN=false
THINGS=()

die() { echo "error: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CERT_ARN="$2"; shift 2 ;;
    -f) THINGS_FILE="$2"; shift 2 ;;
    -p) POLICIES+=("$2"); shift 2 ;;
    -r) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -n) DRY_RUN=true; shift ;;
    *) die "unknown option: $1" ;;
  esac
done

command -v aws >/dev/null || die "aws CLI not found on PATH"
[[ -n "$CERT_ARN" ]] || die "-c CERT_ARN is required"
[[ -f "$THINGS_FILE" ]] || die "-f things file not found"

while IFS= read -r line; do
  line="${line%%#*}"; line="$(echo "$line" | xargs)"
  [[ -n "$line" ]] && THINGS+=("$line")
done < "$THINGS_FILE"

CERT_ID="${CERT_ARN##*/}"   # cert id is the trailing path segment of the ARN

AWS=(aws)
[[ -n "$REGION" ]]  && AWS+=(--region "$REGION")
[[ -n "$PROFILE" ]] && AWS+=(--profile "$PROFILE")

run() {
  if $DRY_RUN; then echo "DRY: ${AWS[*]} $*"; return 0; fi
  "${AWS[@]}" "$@" || echo "   (ignored) failed: $*" >&2
}

echo ">> Tearing down ${#THINGS[@]} thing(s) and cert $CERT_ID"

# 1. Detach policies from the cert.
for pol in "${POLICIES[@]}"; do
  run iot detach-policy --policy-name "$pol" --target "$CERT_ARN"
done

# 2. Detach the cert from each thing, then delete the thing.
for t in "${THINGS[@]}"; do
  echo "--- $t"
  run iot detach-thing-principal --thing-name "$t" --principal "$CERT_ARN"
  run iot delete-thing --thing-name "$t"
done

# 3. Deactivate + delete the shared cert.
run iot update-certificate --certificate-id "$CERT_ID" --new-status INACTIVE
run iot delete-certificate --certificate-id "$CERT_ID" --force-delete

echo ">> Teardown complete"
