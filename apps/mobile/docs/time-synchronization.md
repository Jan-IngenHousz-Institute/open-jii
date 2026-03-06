# Time Synchronization for AWS IoT Core

## Problem

AWS IoT Core requires accurate timestamps for SigV4 authentication. If a device's clock is off by more than 5 minutes, authentication will fail with a signature mismatch error. This can happen due to:
- Incorrect device time settings
- Timezone misconfiguration
- Clock drift on the device
- Manual time changes by the user

## Solution

We've implemented a server-based time synchronization mechanism that always uses backend server time for AWS authentication instead of relying on the device's local time.

The implementation:

1. Fetches the current time from the backend server
2. Caches the server time for 30 seconds to minimize network requests
3. Estimates current server time based on cached value and elapsed local time
4. Falls back to local time only if the server is unreachable

## Implementation

### Backend Endpoint

A new `/health/time` endpoint provides the current server timestamp:

```
GET /health/time

Response:
{
  "timestamp": "2026-03-04T10:30:00.000Z",
  "unixTimestamp": 1709548200000
}
```

### Mobile App

The `getSyncedTime()` utility function in `src/utils/time-sync.ts`:
- Fetches server time on first call or after cache expires (30s)
- Caches both server time and local time at fetch moment
- Estimates current server time by adding elapsed local time to cached server time
- Falls back to local time if server is unreachable

### Usage

The MQTT connection automatically uses synchronized time:

```typescript
import { getSyncedTime } from "~/utils/time-sync";

// Instead of: new Date()
const now = await getSyncedTime();
```

## Benefits

- **Prevents authentication failures**: Eliminates AWS IoT Core signature mismatches due to clock skew
- **Always accurate**: Uses server time instead of potentially incorrect device time
- **Minimal performance impact**: Only 1 server call per 30 seconds maximum
- **Graceful degradation**: Falls back to local time if server is unreachable
- **Transparent integration**: Automatically used by MQTT connection, no code changes needed elsewhere

## Technical Details

### Cache Strategy

- **Cache Duration**: 30 seconds
- **Time Estimation**: Between fetches, server time is estimated by adding elapsed local time to the cached server time
- **Cache Invalidation**: Can be manually cleared using `clearTimeSyncCache()` if needed

### Error Handling

If the server is unreachable:
- Logs an error to the console
- Falls back to local device time
- Allows the application to continue functioning (though AWS auth may fail if device time is significantly off)

## Testing

Run the tests with:

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch
```

The test suite covers:
- Server time fetching and usage
- Cache behavior (30-second duration)
- Time estimation from cached values
- Fallback to local time on network errors
- Cache expiration and refetching
