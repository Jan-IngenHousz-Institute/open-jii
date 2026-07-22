import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const captureScript = path.join(appRoot, "scripts/capture-mobile-media.sh");

async function writeExecutable(file, contents) {
  await writeFile(file, contents);
  await chmod(file, 0o755);
}

async function writeFakeCommands(binDirectory) {
  await writeExecutable(
    path.join(binDirectory, "adb"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_ADB_LOG"

if [[ "$1" == "devices" ]]; then
  printf 'List of devices attached\nfixture-device\tdevice\n'
  exit 0
fi

if [[ "$1" == "pull" ]]; then
  [[ "$(cat "$FAKE_ADB_STATE")" == "done" ]] || exit 99
  printf 'raw mp4\n' > "$3"
  printf 'pulled\n' >> "$FAKE_ADB_EVENTS"
  exit 0
fi

[[ "$1" == "shell" ]] || exit 0
shift
case "$1" in
  pm)
    printf 'package:/data/app/openjii/base.apk\n'
    ;;
  dumpsys)
    printf 'showing=false\n'
    ;;
  screenrecord)
    printf 'recording' > "$FAKE_ADB_STATE"
    ;;
  pidof)
    state="$(cat "$FAKE_ADB_STATE")"
    count="$(cat "$FAKE_ADB_COUNT")"
    count=$((count + 1))
    printf '%s' "$count" > "$FAKE_ADB_COUNT"
    if [[ "$state" == "recording" ]]; then
      printf '123\n'
      exit 0
    fi
    if [[ "$state" == "flushing" ]]; then
      if [[ "$FAKE_ADB_MODE" == "stuck" || "$count" -le 2 ]]; then
        printf '123\n'
        exit 0
      fi
      printf 'done' > "$FAKE_ADB_STATE"
      printf 'flush-complete\n' >> "$FAKE_ADB_EVENTS"
      exit 1
    fi
    exit 1
    ;;
  pkill)
    if [[ "$2" == "-INT" ]]; then
      printf 'flushing' > "$FAKE_ADB_STATE"
      printf '0' > "$FAKE_ADB_COUNT"
      printf 'sigint\n' >> "$FAKE_ADB_EVENTS"
    elif [[ "$2" == "-KILL" ]]; then
      printf 'killed' > "$FAKE_ADB_STATE"
      printf 'sigkill\n' >> "$FAKE_ADB_EVENTS"
    fi
    ;;
  test)
    [[ "$(cat "$FAKE_ADB_STATE")" == "done" ]]
    ;;
  rm)
    ;;
esac
`,
  );
  await writeExecutable(
    path.join(binDirectory, "ffmpeg"),
    `#!/usr/bin/env bash
set -euo pipefail
for output; do :; done
printf 'webm\n' > "$output"
`,
  );
  await writeExecutable(path.join(binDirectory, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
}

async function probeMobileRecording(mode) {
  const root = await mkdtemp(path.join(os.tmpdir(), `openjii-mobile-${mode}-`));
  try {
    const binDirectory = path.join(root, "bin");
    const stagingDirectory = path.join(root, "staging");
    const state = path.join(root, "state");
    const count = path.join(root, "count");
    const events = path.join(root, "events");
    const log = path.join(root, "adb.log");
    await mkdir(binDirectory);
    await Promise.all([
      writeFile(state, "idle"),
      writeFile(count, "0"),
      writeFile(events, ""),
      writeFile(log, ""),
    ]);
    await writeFakeCommands(binDirectory);

    const result = spawnSync("bash", [captureScript, "record", "flush-test", "3"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FAKE_ADB_COUNT: count,
        FAKE_ADB_EVENTS: events,
        FAKE_ADB_LOG: log,
        FAKE_ADB_MODE: mode,
        FAKE_ADB_STATE: state,
        OPENJII_CAPTURE_STAGING_DIR: stagingDirectory,
        PATH: `${binDirectory}:${process.env.PATH}`,
      },
      timeout: 5_000,
    });
    const eventLines = (await readFile(events, "utf8")).trim().split("\n").filter(Boolean);
    assert.ok(eventLines.includes("sigint"), "timeout did not send SIGINT");

    if (mode === "flushes") {
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(eventLines.slice(-3), ["sigint", "flush-complete", "pulled"]);
      assert.ok((await stat(path.join(stagingDirectory, "flush-test.webm"))).size > 0);
    } else {
      assert.notEqual(result.status, 0, "stuck device recorder must fail");
      assert.equal(eventLines.includes("pulled"), false, "stuck recorder was pulled before flush");
      assert.ok(eventLines.includes("sigkill"));
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

await probeMobileRecording("flushes");
await probeMobileRecording("stuck");

console.log(
  "Media tooling checks passed: screenrecord waits for SIGINT flush before pull and fails closed on a stuck encoder.",
);
