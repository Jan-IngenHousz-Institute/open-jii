# Time Synchronization

## Problem

AWS IoT Core requires accurate timestamps for SigV4 authentication. If a device's clock is off by more than 5 minutes, authentication will fail. Measurement timestamps also need to be accurate.

## Solution

GPS-based timezone resolution + server time sync with offset tracking.

### Flow

1. **GPS → Timezone**: `expo-location` gets lat/lon, `@photostructure/tz-lookup` resolves the IANA timezone
2. **Server time**: Fetch UTC time from `GET /health/time` on our backend
3. **Offset**: Calculate `offsetMs = serverTime - deviceTime` (adjusted for round-trip latency)
4. **Store in memory**: The offset and timezone are kept in a module-level singleton
5. **Interval**: Re-syncs every 60 minutes; tolerates failures gracefully

### Foreground Re-sync

When the app returns to the foreground (e.g. user switches back from another app or settings), a sync is requested via React Native's `AppState` listener. All sync triggers (foreground, interval, etc.) are funneled through a single [`@tanstack/pacer` Debouncer](https://tanstack.com/pacer/latest/docs/guides/debouncing) configured with `leading: true, trailing: false` and a 5-second wait window. This means:

- The first trigger fires immediately (leading edge).
- Any additional triggers within the 5-second window are silently dropped.
- After the window expires, the next trigger fires immediately again.

This prevents the endless-loop scenario where rapid `AppState` "active" events (common on some Android devices or during quick app-switch gestures) would each kick off a full sync cycle.

### Missed Pings

If 3 consecutive syncs fail, a toast notification warns the user that time may be inaccurate. The last known offset continues to be used.

## Usage

### App Startup

`TimeSyncProvider` wraps the app in `_layout.tsx` and calls `startTimeSync()` on mount.

### MQTT Signing (AWS SigV4)

```typescript
import { getSyncedUtcNow, getTimeSyncState } from "~/utils/time-sync";

const utcTimestampMs = getSyncedUtcNow();
const { timezone } = getTimeSyncState();
```

### Measurement Timestamps

```typescript
import { getSyncedLocalISO, getTimeSyncState } from "~/utils/time-sync";

const timestamp = getSyncedLocalISO(); // e.g. "2026-03-09T10:30:00.000-05:00"
const { timezone } = getTimeSyncState(); // e.g. "America/Chicago"
```

Both the ISO timestamp (with UTC offset) and the IANA timezone are captured at measurement time and included in the upload payload. This ensures that even if the upload is retried later (e.g. from the failed uploads queue), the original measurement-time timezone is preserved.

### Raw UTC

```typescript
import { getSyncedUtcNow, getSyncedUtcDateTime } from "~/utils/time-sync";

const utcMs = getSyncedUtcNow();
const luxonDt = getSyncedUtcDateTime();
```

## Backend Endpoint

`GET /health/time` returns:

```json
{
  "utcTimestampMs": 1773000041000,
  "utcTimestampSec": 1773000041,
  "iso": "2026-03-09T15:00:41.000Z"
}
```

No authentication required (under the existing `/health` controller).
