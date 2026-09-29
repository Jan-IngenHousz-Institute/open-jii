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

### Server-side error reports and consent

The web server and the backend report their own errors whatever a visitor chose on the cookie
banner, as operational telemetry: a report never creates or updates a PostHog person. It carries
the signed-in user's id when there is one, and otherwise a fixed id per service (`web-server`,
`backend-server`). It carries where the error happened, never what the user sent: an `AppError`'s
details stay in the backend's own log. Browser errors reach PostHog only once a visitor accepts
analytics cookies: before that the browser sends them cookieless, and the project drops cookieless
events while its server hashing is off (`cookieless_server_hash_mode` in
`infrastructure/modules/posthog`).

Only deployed builds send anything. On a developer's machine the backend (`NODE_ENV` other than
`production`), the web app (`NEXT_PUBLIC_ENVIRONMENT=local`) and a Metro phone build still read
feature flags, but their `before_send` drops every event (`dropEveryEvent` here), since every
environment shares one PostHog project.

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
