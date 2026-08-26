---
name: openjii-mobile-device
description: Build the openJII mobile app and get it onto a real Android phone, over USB cable or Wi-Fi, wired to a locally running backend. Use for mobile dev builds, installing on a device, connecting a phone to local Metro and the local API, and diagnosing Android build failures.
---

# Mobile dev build on a real device

Read `AGENTS.md` first. Android is the only published platform; iOS is UI-only.

All commands run from the repo root unless stated. Substitute your own JDK and SDK paths — the
values differ per machine.

## 1. Prerequisites that actually bite

- **JDK 17.** A newer JDK breaks the Android build in a way that hides itself: New-Architecture C++
  modules fail during their CMake configure step with only a vague warning about restricted methods,
  and no CMake error. If you see that, check `java -version` before anything else.
- **After switching JDKs, stop the app's Gradle daemons**
  (`cd apps/mobile/android && ./gradlew --stop`). A stale daemon started under the wrong JDK gets
  reused and reproduces the failure.
- **`apps/mobile/android/local.properties` must contain `sdk.dir=<your Android SDK path>`.** It is
  gitignored, and `pnpm clean:workspaces` deletes it — after any clean, recreate it or the build
  fails with "SDK location not found".
- **A fresh worktree has no `apps/mobile/.env`.** Those files are gitignored, so a build there
  inlines no `EXPO_PUBLIC_*` values and a release build crashes at JS startup on a missing variable.
  Copy the env files from a working checkout before building.

## 2. Connect the phone

Either transport works; both end with the phone reaching your machine's `localhost`.

**USB cable** — the simpler path, and the only one that works without shared Wi-Fi:

```bash
adb devices                          # confirm exactly one device is listed
pnpm --filter mobile adb:reverse     # forwards 8081 (Metro), 3000 (web), 3020 (backend)
```

**Wi-Fi** — connect by cable once, then cut it loose:

```bash
apps/mobile/scripts/adb-connect.sh   # reads the phone's IP, restarts adb in TCP mode, connects
pnpm --filter mobile adb:reverse     # still needed: reverse works over the TCP connection too
```

`adb reverse` is what makes `localhost:3020` on the phone mean _your_ backend. Without it the app
has no route to a locally running API.

**Do not reach for `expo start --tunnel`.** It routes through an external relay, is slow, and fails
outright on networks without egress. Cable or LAN plus `adb reverse` covers both cases.

## 3. Build and install

```bash
cd apps/mobile
pnpm exec expo run:android      # debug build, installs, starts Metro
```

Useful variations:

- `pnpm --filter mobile build:debug` / `build:release` — Gradle directly, skipping lint and tests.
- A local `build:release` embeds the JavaScript bundle and runs without Metro, but the repository
  signs it with the debug keystore. Use it only for local testing. For handoff, use an EAS build or
  configure an explicit release keystore. Prefer a release-signed EAS or Play artifact.
- Release builds every ABI by default. Pass your device's ABI via
  `ORG_GRADLE_PROJECT_reactNativeArchitectures=<abi>` for a much faster build.
- **JS-only changes need no rebuild.** Point Metro at the branch and reload the dev client.
- `expo run:android --device` expects a device _name_, not an adb serial. With one device attached,
  omit the flag.

## 4. When it goes wrong

- Build fails right after a JDK change → stale Gradle daemon (see above).
- "SDK location not found" → `local.properties` was wiped.
- Release build crashes instantly at startup → missing `EXPO_PUBLIC_*`. After adding the env file,
  Gradle may still reuse the stale bundle because env files are not task inputs; delete the
  generated/intermediate build output under `android/app/build` to force a re-bundle.
- Corrupt Gradle journal lock after an interrupted build → stop the daemons and remove the lock file
  under `~/.gradle/caches`.
- Never copy a built `android/` directory between checkouts. Its task history points at the other
  checkout's `node_modules` and produces missing-native-library failures.

To drive the installed app and test it, use the `openjii-mobile-control` skill.
