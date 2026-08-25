---
name: openjii-mobile-control
description: Drive and test the openJII Android app on a connected phone via adb — tap, type, swipe, navigate, screenshot, and read the on-screen view hierarchy. Use to verify mobile behaviour on a real device, reproduce a mobile bug, or check a screen after a change.
---

# Driving the phone

Read `AGENTS.md` first. Getting a build onto the device is the `openjii-mobile-device` skill; this
one assumes the app is installed and a device is attached (cable or Wi-Fi both fine).

**Only ever drive a development device with a throwaway account.** These commands are
indistinguishable from a real user, and screenshots capture whatever is on screen.

```bash
adb devices    # exactly one 'device' line, or pass -s <serial> to every command below
```

## Look before you tap

Blind coordinate tapping is the main way this goes wrong — it appears to work and silently taps the
background. Read the hierarchy first:

```bash
adb exec-out uiautomator dump /dev/tty
```

That XML gives every visible node with a `bounds="[x1,y1][x2,y2]"` attribute plus its `text`,
`content-desc` and `resource-id`. Find your target by text or id, compute the centre of its bounds,
and tap that. Re-dump after every navigation — bounds change with layout and scroll position.

If a node has no `text` and no `content-desc`, that is a real accessibility gap worth reporting
rather than working around with a hardcoded coordinate.

## Interacting

```bash
adb shell input tap <x> <y>
adb shell input swipe <x1> <y1> <x2> <y2> [ms]     # scrolling: swipe up to go down
adb shell input text 'hello'                        # no spaces; use %s, and quote it
adb shell input keyevent KEYCODE_BACK               # also KEYCODE_ENTER, KEYCODE_TAB
```

Deep-linking straight to a screen is faster and less brittle than navigating through the UI:

```bash
adb shell am start -a android.intent.action.VIEW -d '<scheme>://<path>'
adb shell am force-stop <package>      # cold start
adb shell pm clear <package>           # wipe app data — destructive, ask first
```

Get the package name from the app config rather than assuming it.

## Seeing what happened

```bash
adb exec-out screencap -p > /tmp/screen.png       # then read the image
adb shell screenrecord --time-limit 20 /sdcard/rec.mp4 && adb pull /sdcard/rec.mp4
```

Take a screenshot after each meaningful step — it is the only way to confirm the tap landed where
the hierarchy said it would.

## Logs

```bash
adb logcat -c && adb logcat --pid=$(adb shell pidof -s <package>)
```

**Some devices return nothing from `logcat` at all.** If you get zero lines, that is the device, not
the app — read crashes from the system dropbox instead:

```bash
adb shell dumpsys dropbox --print | tail -100
```

## Checking against the local stack

The app talks to the backend on `localhost:3020`, which only resolves after
`pnpm --filter mobile adb:reverse`. If requests fail with connection errors, check that first — it
does not survive a cable replug or an adb server restart.

Data written by the app should show up in the local Postgres, so a device action can be verified
server-side rather than only by screenshot.

## Reporting

Say what you did, what you observed, and attach the screenshots. Distinguish _the feature is broken_
from _I could not drive the UI_. If you fell back to a hardcoded coordinate because the hierarchy
had no usable identifier, say so — that is a finding.
