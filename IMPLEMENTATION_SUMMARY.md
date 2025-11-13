# Protocol Validation as Warning - Implementation Summary

## Overview

Implemented feature-flagged protocol validation that shows warnings instead of blocking saves.

## Changes Made

### 1. Created `@repo/analytics` Package

A generic analytics package for PostHog integration and feature flags, usable by both frontend and backend.

**Location**: `/packages/analytics/`

**Key Files**:

- `src/feature-flags.ts` - Feature flag definitions and defaults
- `src/posthog-config.ts` - PostHog configuration utilities
- `src/server.ts` - Server-side PostHog integration
- `src/index.ts` - Main exports

**Feature Flags**:

- `MULTI_LANGUAGE` - Multi-language support (default: false)
- `PROTOCOL_VALIDATION_AS_WARNING` - Show protocol validation as warnings (default: **true**)

### 2. Backend Changes

#### Created Analytics Module (`apps/backend/src/common/analytics/`)

- **AnalyticsService**: Injectable NestJS service for feature flags
- **AnalyticsModule**: NestJS module providing AnalyticsService
- Lifecycle hooks: `OnModuleInit` (initialize PostHog), `OnModuleDestroy` (cleanup)

#### Updated Protocol Controller

**File**: `apps/backend/src/protocols/presentation/protocol.controller.ts`

- Injected `AnalyticsService` via constructor
- Modified `validateProtocolCode()` function:
  - Checks `PROTOCOL_VALIDATION_AS_WARNING` feature flag
  - If enabled: validates JSON structure only (allows save)
  - If disabled: validates full protocol schema (blocks save on errors)
- Two validation functions:
  - `validateJsonStructure()` - Basic JSON array validation
  - `validateProtocolCode()` - Full protocol schema validation (optional)

#### Updated Modules

- `app.module.ts` - Added AnalyticsModule to imports
- `protocol.module.ts` - Added AnalyticsModule to imports
- `main.ts` - Removed manual PostHog initialization (now handled by AnalyticsService)

### 3. Frontend Changes

#### Updated Protocol Code Editor

**File**: `apps/web/components/protocol-code-editor.tsx`

- Changed validation errors to warnings
- Monaco editor markers now show as **warnings** (yellow) instead of errors (red)
- Invalid JSON syntax still shows as error (blocks save)
- Protocol schema validation issues show as warnings (allows save)
- Visual indicators:
  - JSON syntax errors: red text "Invalid JSON"
  - Protocol warnings: yellow text with warning count

#### Updated PostHog Config

**File**: `apps/web/lib/posthog-config.ts`

- Now imports from `@repo/analytics` package
- Re-exports for backward compatibility
- Uses shared configuration functions

### 4. Validation Logic

```typescript
// Backend validation flow:
1. Check feature flag: PROTOCOL_VALIDATION_AS_WARNING
2. If TRUE (default):
   - Validate JSON structure only
   - Allow save even with protocol issues
3. If FALSE:
   - Validate full protocol schema
   - Block save on validation errors
```

```typescript
// Frontend validation flow:
1. Parse JSON
2. If invalid JSON:
   - Show error (red)
   - Block save (onChange returns undefined)
3. If valid JSON but protocol issues:
   - Show warnings (yellow)
   - Allow save (onChange returns parsed value)
```

## Environment Variables

Add these to enable PostHog feature flags:

```bash
# Backend
POSTHOG_KEY=your_posthog_api_key
POSTHOG_HOST=https://eu.i.posthog.com

# Frontend (Next.js)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## Installation

```bash
# Install dependencies
pnpm install

# Build the analytics package first
cd packages/analytics
pnpm build

# Build all packages
cd ../..
pnpm build
```

## Dependencies

The implementation uses the following versions from the workspace catalog:

- `posthog-js`: ^1.279.1
- `posthog-node`: ^5.10.2

These are defined as peer dependencies in `@repo/analytics` and installed in:

- `apps/web` - for client-side feature flags
- `apps/backend` - for server-side feature flags

## Testing

The feature flag defaults to `true`, meaning validation warnings are enabled by default.

To test different behaviors:

1. **With feature flag** (default): Protocol validation shows as warnings, saves are allowed
2. **Without feature flag**: Set flag to `false` in PostHog dashboard for strict validation

## Benefits

1. **Experimental protocols**: Developers can save work-in-progress protocols
2. **Iterative development**: Test incomplete protocols without validation blocking
3. **Backward compatible**: Existing protocols continue to work
4. **Flexible**: Can be toggled via feature flag without code deployment
5. **User-friendly**: Clear visual distinction between errors (JSON) and warnings (protocol)

## Future Enhancements

- Add more granular feature flags for specific validation rules
- Client-side feature flag checking (currently server-side only)
- Analytics tracking for validation warnings
- User preferences for validation strictness
