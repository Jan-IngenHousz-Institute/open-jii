# @repo/analytics

Generic analytics and feature flag package for both frontend and backend.

## Features

- Feature flag configuration
- PostHog integration (client and server)
- Extensible for other analytics services

## Usage

### Feature Flags

```typescript
import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

// Check default value
const isEnabled = FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING];
```

### Server-side PostHog

```typescript
import {
  initializePostHogServer,
  isFeatureFlagEnabled,
  FEATURE_FLAGS,
} from "@repo/analytics/server";

// Initialize (once at app startup)
await initializePostHogServer(process.env.POSTHOG_KEY, {
  host: process.env.POSTHOG_HOST,
});

// Check feature flag
const isEnabled = await isFeatureFlagEnabled(FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING, userId);
```

### Client-side PostHog

```typescript
import posthog from "posthog-js";
import { createPostHogClientConfig } from "@repo/analytics";

// With reverse proxy (recommended to avoid ad blockers)
const config = createPostHogClientConfig(
  "/ingest",                    // API host - your reverse proxy path
  "https://eu.posthog.com"      // UI host - PostHog domain for toolbar
);
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, config);

// Direct connection (no proxy)
const config = createPostHogClientConfig(
  "https://eu.i.posthog.com",   // API host - PostHog ingestion endpoint
  "https://eu.posthog.com"      // UI host - PostHog domain for toolbar
);
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, config);
```

## Available Feature Flags

- `MULTI_LANGUAGE`: Enable multi-language support
- `PROTOCOL_VALIDATION_AS_WARNING`: Show protocol validation as warnings instead of errors
