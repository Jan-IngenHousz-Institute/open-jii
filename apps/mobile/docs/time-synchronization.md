# Time Synchronization for AWS IoT Core

## Problem

AWS IoT Core requires accurate timestamps for SigV4 authentication. If a device's clock is off by more than 5 minutes, authentication will fail with a signature mismatch error. This can happen due to:
- Incorrect device time settings
- Timezone misconfiguration
- Clock drift on the device
- Manual time changes by the user

## Solution

We fetch the current UTC time from the [World Time API](https://worldtimeapi.org/api/ip), which returns accurate time based on the client's IP address. This is independent of the device's clock settings.

## Implementation

### Mobile App

The `getSyncedUtcTimestampWithTimezone()` utility in `src/utils/time-sync.ts`:
- Fetches current time from `https://worldtimeapi.org/api/ip`
- Returns `unixtime` (converted to milliseconds) and `timezone`
- Throws on network errors or non-ok responses

### Usage

The MQTT connection automatically uses synchronized time:

```typescript
import { getSyncedUtcTimestampWithTimezone } from "~/utils/time-sync";

const { utcTimestamp, timezone } = await getSyncedUtcTimestampWithTimezone();
```

## Technical Details

- No caching — each signing request gets a fresh server timestamp
- AWS SigV4 allows up to 5 minutes of clock skew
- The API resolves timezone from the client's public IP

### Error Handling

If the API is unreachable or returns an error, the function throws. Callers should handle this appropriately since falling back to device time would defeat the purpose.
