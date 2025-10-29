# PostHog Turbopack Compatibility Fix

## Problem
The `posthog-js` package contains references to Node.js built-in modules (`node:child_process`, etc.) which Turbopack cannot bundle for the browser, causing build errors:

```
the chunking context (unknown) does not support external modules (request: node:child_process)
```

## Solution
Switched from dynamic `import("posthog-js")` to CDN-based script loading, which is the recommended approach for Next.js 15+ with Turbopack.

## Changes Made

### 1. PostHogProvider.tsx
- **Before**: Used `import("posthog-js")` dynamic import
- **After**: Injects PostHog via CDN script tag (official PostHog snippet)
- **Why**: Avoids bundling `posthog-js` entirely, preventing Turbopack from analyzing its Node.js dependencies

### 2. use-posthog-feature-flags.ts
- **Before**: Imported and used `posthog-js` module
- **After**: Accesses `window.posthog` global object
- **Why**: Works with CDN-loaded PostHog, no bundling needed

### 3. next.config.js
- **Before**: Had webpack config with fallbacks for Node.js modules
- **After**: Clean config, only externalizes `posthog-node` for server
- **Why**: Webpack config doesn't apply to Turbopack and caused warnings

### 4. Test Files
- **Before**: Mocked `posthog-js` module with `vi.mock()`
- **After**: Sets `window.posthog` directly in tests
- **Why**: Matches new CDN-based implementation

## Benefits

1. ✅ **Turbopack Compatible**: No more Node.js module bundling issues
2. ✅ **Cleaner Build**: Smaller bundle, PostHog loaded from CDN
3. ✅ **Faster Dev**: No webpack fallback warnings
4. ✅ **Official Pattern**: Follows PostHog's recommended Next.js approach
5. ✅ **Works with Dev & Build**: Both `pnpm dev` and `pnpm build` pass

## Testing

```bash
# Dev server (with Turbopack)
pnpm dev --filter=web
✅ Starts successfully, no errors

# Build
pnpm build --filter=web
✅ Builds successfully

# Tests
pnpm test --filter=web
✅ All tests pass
```

## Migration Notes

- No breaking changes for existing code
- Feature flags work identically
- PostHog loads asynchronously from CDN
- Slight delay in initial load (<100ms), but non-blocking

## References

- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
- [Turbopack External Modules](https://turbo.build/pack/docs/features/resolving-extensions)
- [Next.js Turbopack Config](https://nextjs.org/docs/app/api-reference/next-config-js/turbopack)
