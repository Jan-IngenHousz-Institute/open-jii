# PostHog Integration

This document describes the PostHog feature flag integration in the web application.

## Overview

PostHog is integrated for:

- Feature flag management (client and server-side)
- Analytics tracking (page views, exceptions, user behavior)
- A/B testing and experimentation

## Architecture

### Client-Side

- **PostHogProvider**: Initializes PostHog client via CDN script injection
- **usePostHogFeatureFlag**: React hook for checking feature flags in components
- Uses global `window.posthog` object for better Turbopack compatibility
- Automatic page view tracking
- Real-time feature flag updates

**Why CDN approach?**  
Using CDN script injection avoids bundling `posthog-js` with Turbopack, which prevents issues with Node.js built-in module references. This is the recommended approach for Next.js 15+ with Turbopack.

### Server-Side

- **posthog-server**: Singleton PostHog client for server-side checks
- LRU cache with configurable TTL (default 60s)
- Circuit breaker pattern for resilience
- Used in middleware for request-level decisions

## Setup

### 1. Environment Variables

Create a `.env.local` file in `apps/web/`:

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_ACTUAL_KEY_HERE
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

**Security**: Never commit real API keys to the repository!

### 2. PostHog Configuration

Get your API key from: https://app.posthog.com/project/settings

## Usage

### Defining Feature Flags

Add new feature flags to `lib/posthog-config.ts`:

```typescript
export const FEATURE_FLAGS = {
  MULTI_LANGUAGE: "multi-language",
  NEW_FEATURE: "new-feature",
} as const;

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.MULTI_LANGUAGE]: false,
  [FEATURE_FLAGS.NEW_FEATURE]: false, // Conservative default
};
```

### Client-Side Usage

```tsx
import { usePostHogFeatureFlag } from "@/hooks/use-posthog-feature-flags";
import { FEATURE_FLAGS } from "@/lib/posthog-config";

function MyComponent() {
  const isEnabled = usePostHogFeatureFlag(FEATURE_FLAGS.NEW_FEATURE);

  // null = loading
  if (isEnabled === null) {
    return <Skeleton />;
  }

  // false = disabled
  if (!isEnabled) {
    return null;
  }

  // true = enabled
  return <NewFeatureComponent />;
}
```

### Server-Side Usage (Middleware, API Routes, Server Components)

```typescript
import { FEATURE_FLAGS } from "@/lib/posthog-config";
import { isFeatureFlagEnabled } from "@/lib/posthog-server";

export async function middleware(request: NextRequest) {
  const isEnabled = await isFeatureFlagEnabled(FEATURE_FLAGS.NEW_FEATURE);

  if (!isEnabled) {
    return NextResponse.redirect("/not-available");
  }

  return NextResponse.next();
}
```

## Configuration

### Cache Settings

Edit `lib/posthog-config.ts`:

```typescript
export const CACHE_CONFIG = {
  TTL_MS: 60_000, // Cache duration
  MAX_SIZE: 1000, // Max cached entries
  CLEANUP_INTERVAL_MS: 300_000, // Cleanup interval
};
```

### Circuit Breaker

Prevents cascading failures when PostHog is unavailable:

```typescript
export const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5, // Failures before opening
  SUCCESS_THRESHOLD: 2, // Successes to close
  TIMEOUT_MS: 30_000, // Time before retry
};
```

## Best Practices

### 1. Always Use Type-Safe Flag Keys

❌ Bad:

```typescript
usePostHogFeatureFlag("my-feature");
```

✅ Good:

```typescript
usePostHogFeatureFlag(FEATURE_FLAGS.MY_FEATURE);
```

### 2. Provide Conservative Defaults

Always default to feature OFF for safety:

```typescript
export const FEATURE_FLAG_DEFAULTS = {
  [FEATURE_FLAGS.NEW_FEATURE]: false, // ✅ Safe default
};
```

### 3. Handle Loading States

```tsx
const isEnabled = usePostHogFeatureFlag(FEATURE_FLAGS.NEW_FEATURE);

if (isEnabled === null) {
  return <Skeleton />; // Don't block rendering
}
```

### 4. Don't Overuse Server-Side Checks

Middleware runs on every request. Consider:

- Caching decisions at the application level
- Moving checks to API routes or server components
- Using client-side flags when appropriate

### 5. Monitor Performance

```typescript
import { getCircuitBreakerState } from "@/lib/posthog-server";

// In monitoring/health check endpoint
const state = getCircuitBreakerState();
// Returns: "CLOSED" | "OPEN" | "HALF_OPEN"
```

## Testing

### Unit Tests

Mock feature flags in tests:

```typescript
import { setTestMode, setTestFeatureFlag } from "@/lib/posthog-server";

beforeEach(() => {
  setTestMode(true);
  setTestFeatureFlag(FEATURE_FLAGS.MY_FEATURE, true);
});

afterEach(() => {
  setTestMode(false);
});
```

### Integration Tests

Test with real PostHog in staging environment.

## Troubleshooting

### Feature Flags Not Loading

1. Check API key is set correctly
2. Check browser console for PostHog errors
3. Verify network requests to `/ingest` endpoint
4. Check PostHog dashboard for flag configuration

### Circuit Breaker Open

```bash
# Check circuit breaker state
curl https://your-app.com/api/health | grep posthog
```

If open, PostHog API is experiencing issues. Defaults will be used.

### Cache Issues

Clear cache programmatically:

```typescript
import { clearFeatureFlagCache } from "@/lib/posthog-server";

clearFeatureFlagCache();
```

## Migration Guide

### From Old Implementation

1. Replace magic strings with `FEATURE_FLAGS` constants
2. Update imports to use new paths
3. Update tests to use `setTestMode`
4. Add default values to `FEATURE_FLAG_DEFAULTS`

## Security

- ✅ API keys loaded from environment
- ✅ No keys committed to repository
- ✅ Fail closed on errors (features disabled by default)
- ✅ Circuit breaker prevents DDoS on PostHog
- ✅ Request caching reduces API calls

## Performance

- **Client-side**: Single initialization, async loading
- **Server-side**: 60s cache TTL, 1000 entry LRU cache
- **Middleware**: Average overhead <5ms (cached)
- **Turbopack**: Fully compatible with Next.js Turbopack for fast development

## Technical Details

### Turbopack Compatibility

The PostHog integration is fully compatible with Next.js Turbopack:

- **Dynamic imports**: PostHog is loaded dynamically on the client to avoid bundling issues
- **Server externals**: `posthog-js` is marked as a server external package (client-only)
- **No webpack config**: Uses Next.js native `serverExternalPackages` instead of webpack config
- **Development**: Run with `pnpm dev` (uses `--turbopack` flag)

### Build Configuration

```javascript
// next.config.js
const nextConfig = {
  // PostHog proxy rewrites
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["posthog-js"], // Prevent server-side bundling
};
```

## Further Reading

- [PostHog Documentation](https://posthog.com/docs)
- [Feature Flags Best Practices](https://posthog.com/docs/feature-flags/best-practices)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Next.js Turbopack](https://nextjs.org/docs/architecture/turbopack)
