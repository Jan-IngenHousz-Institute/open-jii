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

## Targeting an organisation

Every flag evaluation for a signed-in user carries `organization_ids`, the ids of every organisation
they belong to, comma-joined (`flagPersonProperties`). PostHog evaluates with it without storing it,
so organisation targeting applies before the user accepts analytics cookies. The browser adds the
user's `email` only once they accept, and only then are the properties also stored on their PostHog
person; server checks always send the email. Evaluations record no `$feature_flag_called` events,
so checking a flag never creates a person.

Flags are code in `infrastructure/modules/posthog/flags.json`, so a rollout change is a pull request
(see that module's README). To turn a flag on for an organisation's members:

1. In openJII, open the organisation and copy its id from the address bar:
   `/platform/organizations/<id>`.
2. In `flags.json`, add a group to the flag's `filters.groups`:
   `{ "properties": [{ "key": "organization_ids", "type": "person", "value": "<id>", "operator": "icontains" }], "rollout_percentage": 100 }`.
   `icontains` is PostHog's "contains"; `exact` ("is any of") never matches this property.
3. Groups are OR'd, so each further organisation gets its own group.

The change goes live when its pull request merges. Members then get the flag on their next page
load, and backend checks follow within a minute. Adding someone to the organisation in openJII puts
them in the rollout.

The browser identifies a user by id once they accept analytics cookies and evaluates under a
cookieless id before that, while the web server and the backend evaluate under their email. Only
`organization_ids` conditions and plain 0% or 100% rollouts give the browser and the servers the
same answer. A rollout between 1% and 99% can show an action in the browser that the backend then
refuses, or hide one it would allow, and so can a condition on `email` until the user accepts
cookies.

## Available Feature Flags

- `MULTI_LANGUAGE`: Enable multi-language support
- `PROTOCOL_VALIDATION_AS_WARNING`: Show protocol validation as warnings instead of errors
