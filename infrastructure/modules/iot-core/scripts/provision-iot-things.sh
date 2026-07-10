#!/usr/bin/env bash
#
# Provision AWS IoT things: create thing -> create/attach cert -> attach policy.
#
# Usage:
#   ./provision-iot-things.sh -p POLICY [options] THING_NAME...
#   ./provision-iot-things.sh -p POLICY -f things.txt [options]
#
# Options:
#   -p POLICY      IoT policy name to attach to each cert (repeatable) [required]
#   -f FILE        File of thing names, one per line (# comments and blanks ignored)
#   -m MODE        Cert mode: "per-thing" (default) or "shared"
#   -g GROUP       Thing group to add each thing to (optional)
#   -o DIR         Output dir for cert/key files (default: ./iot-certs)
#   -r REGION      AWS region (else uses your default config)
#   --profile NAME AWS CLI profile
#   -n             Dry run: print what would happen, make no changes
#
# Notes:
#   * Policies attach to the CERT, not the thing.
#   * Private keys are returned only once, at creation; they are saved under -o DIR.
#   * A thing that already has a certificate attached is skipped (no duplicate cert).

set -euo pipefail

POLICIES=()
THINGS_FILE=""
MODE="per-thing"
GROUP=""
OUT_DIR="./iot-certs"
REGION=""
PROFILE=""
DRY_RUN=false
THINGS=()

die() { echo "error: $*" >&2; exit 1; }

# --- parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p) POLICIES+=("$2"); shift 2 ;;
    -f) THINGS_FILE="$2"; shift 2 ;;
    -m) MODE="$2"; shift 2 ;;
    -g) GROUP="$2"; shift 2 ;;
    -o) OUT_DIR="$2"; shift 2 ;;
    -r) REGION="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -n) DRY_RUN=true; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) THINGS+=("$1"); shift ;;
  esac
done

# --- validate ---
command -v aws >/dev/null || die "aws CLI not found on PATH"
[[ ${#POLICIES[@]} -gt 0 ]] || die "at least one -p POLICY is required"
[[ "$MODE" == "per-thing" || "$MODE" == "shared" ]] || die "-m must be per-thing or shared"

if [[ -n "$THINGS_FILE" ]]; then
  [[ -f "$THINGS_FILE" ]] || die "things file not found: $THINGS_FILE"
  while IFS= read -r line; do
    line="${line%%#*}"; line="$(echo "$line" | xargs)"
    [[ -n "$line" ]] && THINGS+=("$line")
  done < "$THINGS_FILE"
fi
[[ ${#THINGS[@]} -gt 0 ]] || die "no thing names given (pass them as args or via -f FILE)"

# Common aws flags
AWS=(aws)
[[ -n "$REGION" ]]  && AWS+=(--region "$REGION")
[[ -n "$PROFILE" ]] && AWS+=(--profile "$PROFILE")

run() {
  if $DRY_RUN; then echo "DRY: ${AWS[*]} $*"; return 0; fi
  "${AWS[@]}" "$@"
}

mkdir -p "$OUT_DIR"
SUMMARY="$OUT_DIR/provisioning-summary.csv"
[[ -f "$SUMMARY" ]] || echo "thing,certificate_arn,status" > "$SUMMARY"

# Attach every requested policy to a cert (idempotent).
attach_policies() {
  local arn="$1"
  for pol in "${POLICIES[@]}"; do
    run iot attach-policy --policy-name "$pol" --target "$arn"
  done
}

# Create a new cert + keypair, save files under OUT_DIR, echo the cert ARN.
create_cert() {
  local name="$1"
  if $DRY_RUN; then echo "arn:aws:iot:REGION:ACCOUNT:cert/DRY-$name"; return 0; fi
  "${AWS[@]}" iot create-keys-and-certificate \
    --set-as-active \
    --certificate-pem-outfile "$OUT_DIR/$name.cert.pem" \
    --public-key-outfile      "$OUT_DIR/$name.public.key" \
    --private-key-outfile     "$OUT_DIR/$name.private.key" \
    --query certificateArn --output text
}

# Does this thing already have a principal (cert) attached?
thing_has_principal() {
  local name="$1"
  local principals
  principals=$("${AWS[@]}" iot list-thing-principals --thing-name "$name" \
    --query 'principals' --output text 2>/dev/null || true)
  [[ -n "$principals" && "$principals" != "None" ]]
}

echo ">> Provisioning ${#THINGS[@]} thing(s) | mode=$MODE | policies=${POLICIES[*]}"
$DRY_RUN && echo ">> DRY RUN: no changes will be made"

SHARED_ARN=""
if [[ "$MODE" == "shared" ]]; then
  echo ">> Creating one shared certificate for all things"
  SHARED_ARN=$(create_cert "shared")
  attach_policies "$SHARED_ARN"
  echo ">> shared cert: $SHARED_ARN"
fi

for t in "${THINGS[@]}"; do
  echo "--- $t"

  # Idempotent thing create. Dry run still reads, so it reports existing vs new.
  if "${AWS[@]}" iot describe-thing --thing-name "$t" >/dev/null 2>&1; then
    echo "   thing exists"
  else
    run iot create-thing --thing-name "$t" >/dev/null
    $DRY_RUN && echo "   would create thing" || echo "   thing created"
  fi

  if [[ "$MODE" == "shared" ]]; then
    arn="$SHARED_ARN"
  else
    if thing_has_principal "$t"; then
      echo "   already has a cert, skipping cert creation"
      echo "$t,(existing),skipped" >> "$SUMMARY"
      continue
    fi
    arn=$(create_cert "$t")
    attach_policies "$arn"
    echo "   cert: $arn"
  fi

  run iot attach-thing-principal --thing-name "$t" --principal "$arn"

  if [[ -n "$GROUP" ]]; then
    run iot add-thing-to-thing-group --thing-group-name "$GROUP" --thing-name "$t"
    echo "   added to group: $GROUP"
  fi

  echo "$t,$arn,ok" >> "$SUMMARY"
  echo "   done"
done

echo ">> Summary written to $SUMMARY"
$DRY_RUN || echo ">> Cert/key files are in $OUT_DIR (keep the .private.key files safe)"
