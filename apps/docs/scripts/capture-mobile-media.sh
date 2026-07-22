#!/usr/bin/env bash

set -euo pipefail

PACKAGE="com.openjii.app"
DOCS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
STAGING_DIR="${OPENJII_CAPTURE_STAGING_DIR:-$DOCS_DIR/.capture/mobile}"
REMOTE_DIR="/sdcard"

usage() {
  cat <<'EOF'
Usage:
  capture-mobile-media.sh preflight
  capture-mobile-media.sh screenshot <slug>
  capture-mobile-media.sh record <slug> [seconds]

Captures are written to apps/docs/.capture/mobile for privacy review. They are
never copied to public/img automatically. Use only a non-sensitive dev testing
account, review every frame, then publish and record the checksum in
apps/docs/media/mobile/manifest.json.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

device_count() {
  adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

require_device() {
  local count
  count=$(device_count)
  if [[ "$count" -ne 1 ]]; then
    echo "Expected exactly one ready ADB device; found $count." >&2
    exit 1
  fi

  adb shell pm path "$PACKAGE" >/dev/null 2>&1 || {
    echo "The production openJII package ($PACKAGE) is not installed." >&2
    exit 1
  }

  if adb shell dumpsys window policy 2>/dev/null | awk '/showing=/{ exit !($0 ~ /true/) }'; then
    echo "Unlock the phone before capturing." >&2
    exit 1
  fi
}

validate_slug() {
  [[ "${1:-}" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || {
    echo "Slug must contain lowercase letters, numbers, and single hyphens." >&2
    exit 1
  }
}

print_preflight() {
  local count
  count=$(device_count)
  echo "ready_devices=$count"
  [[ "$count" -eq 1 ]] || return 1

  if adb shell pm path "$PACKAGE" >/dev/null 2>&1; then
    echo "openjii_installed=yes"
    adb shell dumpsys package "$PACKAGE" 2>/dev/null |
      awk -F= '/versionName=/{ print "app_version=" $2; exit }'
    adb shell dumpsys package "$PACKAGE" 2>/dev/null |
      awk -F= '/versionCode=/{ sub(/ .*/, "", $2); print "app_version_code=" $2; exit }'
  else
    echo "openjii_installed=no"
  fi

  echo "device_model=$(adb shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')"
  echo "android_release=$(adb shell getprop ro.build.version.release 2>/dev/null | tr -d '\r\n')"
  adb shell wm size 2>/dev/null |
    awk -F': ' '/Physical size/{ print "display_size=" $2 }' | tr -d '\r'
}

capture_screenshot() {
  local slug="$1" raw output
  validate_slug "$slug"
  require_device
  require_command ffmpeg
  mkdir -p "$STAGING_DIR"
  raw="$STAGING_DIR/$slug.raw.png"
  output="$STAGING_DIR/$slug.png"

  adb exec-out screencap -p >"$raw"
  ffmpeg -hide_banner -loglevel error -y -i "$raw" -map_metadata -1 \
    -compression_level 9 -pred mixed "$output"
  rm -f "$raw"
  echo "Staged screenshot: $output"
  echo "Review the full image for credentials, notifications, private datasets, locations, and dev-only UI."
}

capture_recording() {
  local slug="$1" seconds="$2" remote raw output client_pid client_status=0 elapsed=0
  local interrupt_sent=0 flush_elapsed=0
  validate_slug "$slug"
  if [[ ! "$seconds" =~ ^[0-9]+$ ]] || ((seconds < 3 || seconds > 180)); then
    echo "Recording duration must be 3-180 seconds." >&2
    exit 1
  fi
  require_device
  require_command ffmpeg
  mkdir -p "$STAGING_DIR"
  remote="$REMOTE_DIR/openjii-docs-$slug.mp4"
  raw="$STAGING_DIR/$slug.raw.mp4"
  output="$STAGING_DIR/$slug.webm"

  adb shell rm -f "$remote" >/dev/null 2>&1 || true
  echo "Recording for up to $seconds seconds. Interact physically with the phone now."
  adb shell screenrecord --bit-rate 8000000 --time-limit "$seconds" "$remote" &
  client_pid=$!
  wait "$client_pid" || client_status=$?

  # Some OEMs detach screenrecord from the ADB client. Wait for the device-side
  # encoder instead of deleting its still-open output.
  while adb shell pidof screenrecord >/dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if ((elapsed > seconds + 5 && interrupt_sent == 0)); then
      echo "Recorder exceeded its time limit; requesting a graceful device-side flush..." >&2
      adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
      interrupt_sent=1
    elif ((interrupt_sent == 1)); then
      flush_elapsed=$((flush_elapsed + 1))
      if ((flush_elapsed > 10)); then
        adb shell pkill -KILL screenrecord >/dev/null 2>&1 || true
        adb shell rm -f "$remote" >/dev/null 2>&1 || true
        echo "Recorder did not finish flushing within 10 seconds after SIGINT." >&2
        exit 1
      fi
    fi
  done

  if ! adb shell test -s "$remote"; then
    adb shell rm -f "$remote" >/dev/null 2>&1 || true
    echo "Recorder produced no usable file (ADB client status $client_status)." >&2
    exit 1
  fi

  adb pull "$remote" "$raw" >/dev/null
  adb shell rm -f "$remote" >/dev/null 2>&1
  ffmpeg -hide_banner -loglevel error -y -i "$raw" -map_metadata -1 -an \
    -vf "scale='min(1080,iw)':-2" -c:v libvpx-vp9 -crf 34 -b:v 0 \
    -row-mt 1 -deadline good -cpu-used 2 "$output"
  rm -f "$raw"
  echo "Staged recording: $output"
  echo "Play it end to end before publishing; sampled contact sheets are not sufficient."
}

require_command adb

case "${1:-}" in
  preflight)
    print_preflight
    ;;
  screenshot)
    [[ $# -eq 2 ]] || { usage; exit 1; }
    capture_screenshot "$2"
    ;;
  record)
    [[ $# -ge 2 && $# -le 3 ]] || { usage; exit 1; }
    capture_recording "$2" "${3:-60}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
