# Time Synchronization

## Why This Exists

AWS IoT Core uses SigV4 request signing for authentication, which embeds a timestamp in every MQTT connection. If the device clock is off by more than 5 minutes from the server's clock, AWS rejects the connection outright. Mobile device clocks are not reliable—users may have automatic time disabled, be in the middle of a timezone change, or have drifted clocks. Measurement timestamps face the same problem: a timestamp recorded with the wrong timezone or a skewed clock produces bad data.

The solution is to treat the device clock as untrustworthy and synchronize against the server on every foreground entry.

## Why Location → Timezone → API Call?

This three-step chain exists because each step solves a different problem that the previous step cannot:

### Step 1: Location → Timezone (GPS coordinates via `expo-location` + `@photostructure/tz-lookup`)

The device knows what time it *thinks* it is, but it does not reliably know what timezone it is in—especially at startup, after roaming, or when the user has changed timezones without restarting. The system timezone setting can lag reality.

We use GPS coordinates and a bundled timezone boundary database (`@photostructure/tz-lookup`) to resolve the correct [IANA timezone](https://www.iana.org/time-zones) (e.g. `"America/Chicago"`) from the device's physical location. This is done entirely offline—no network call needed. The resolved timezone is captured once per sync and stored alongside the time offset so it travels with every measurement.

**Why not just use the system timezone?** The system timezone is user-controlled and can be wrong. A device roaming into a new timezone may not update until the next network sync. More critically, users can manually set both the timezone *and* the device clock to any value — meaning device time ≠ actual time. GPS is ground truth for location; the server is ground truth for time.

### Step 2: Server Time (API call to `GET /health/time`)

The GPS step gives us the correct timezone label, but it does not fix a skewed device clock—a phone in `"America/Chicago"` can still show the wrong time. We fetch the server's current UTC time to establish what time it actually is.

The endpoint is unauthenticated (under the existing `/health` controller) so it can be called before any user session is established:

```json
{
  "utcTimestampMs": 1773000041000,
  "utcTimestampSec": 1773000041,
  "iso": "2026-03-09T15:00:41.000Z"
}
```

### Step 3: Offset Calculation (not clock replacement)

We do not set the device clock—that requires OS permissions we don't have and would be disruptive to the user. Instead we compute a persistent offset:

```
offsetMs = serverTime - deviceTime  (adjusted for round-trip latency)
```

This offset is stored in a module-level singleton. Any code that needs an accurate timestamp must call `getSyncedUtcNow()` (or the other `getSynced*` helpers), which apply the offset internally. Using raw `Date.now()` anywhere in the app will give uncorrected device time.

## Foreground Re-sync

When the app returns to the foreground (`AppState` → `"active"`), a sync is re-triggered. All sync triggers (startup, foreground, manual) are funneled through a single [`@tanstack/pacer` Debouncer](https://tanstack.com/pacer/latest/docs/guides/debouncing) with `leading: true, trailing: false` and a 5-second wait window:

- The first trigger fires immediately (leading edge).
- Any additional triggers within the 5-second window are dropped.
- After the window expires, the next trigger fires immediately again.

This prevents an infinite-loop scenario where rapid `AppState` `"active"` events (common on some Android devices during quick app-switch gestures) each kick off a full sync cycle.

## Missed Pings

If 3 consecutive syncs fail (e.g. no network), a toast warns the user that time may be inaccurate. The last known offset continues to be used rather than falling back to an uncorrected device clock.

## Usage

### App Startup

`TimeSyncProvider` wraps the app root in `_layout.tsx` and calls `startTimeSync()` on mount. The first sync must complete before MQTT connections are established.

### MQTT Signing (AWS SigV4)

```typescript
import { getSyncedUtcNow, getTimeSyncState } from "~/utils/time-sync";

// Block until first sync completes before signing—never sign with an unsynced clock
await ensureSynced();

const utcTimestampMs = getSyncedUtcNow();
const { timezone } = getTimeSyncState();
```

### Measurement Timestamps

Both the ISO timestamp and the IANA timezone are captured at measurement time and included in the upload payload:

```typescript
import { getSyncedLocalISO, getTimeSyncState } from "~/utils/time-sync";

const timestamp = getSyncedLocalISO(); // e.g. "2026-03-09T10:30:00.000-05:00"
const { timezone } = getTimeSyncState(); // e.g. "America/Chicago"
```

Capturing both at measurement time (not at upload time) ensures that if the upload is retried later from the failed-uploads queue, the original measurement-time timezone is preserved.

### Raw UTC

```typescript
import { getSyncedUtcNow, getSyncedUtcDateTime } from "~/utils/time-sync";

const utcMs = getSyncedUtcNow();
const luxonDt = getSyncedUtcDateTime();
```

## Implementation

Source: `apps/mobile/src/utils/time-sync.ts`
