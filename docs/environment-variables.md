# Environment Variables

This project uses `@t3-oss/env-core` and `@t3-oss/env-nextjs` for environment variable validation, providing type safety and validation for all environment variables.

## Overview

The environment variable system ensures that:

- Required environment variables are present
- Variables have the correct types
- Variables follow any specified format constraints
- Client-side variables are properly isolated from server-side variables

## Setup

Environment variables are managed through the `@repo/env` package. This package provides validation schemas for different parts of the application.

### Core Environment Variables

These variables are available to all server-side components:

```typescript
// Available in all server-side code through @repo/env
import { env } from "@repo/env";

// Use validated environment variables
const dbUrl = env.DATABASE_URL;
```

### Next.js Environment Variables

Next.js requires special handling for client-side vs server-side environment variables. Our system handles this through:

```typescript
// In Next.js apps, import from ~/env instead of directly from @repo/env
import { env } from "~/env";

// Server-side: Available only in server components/actions/API routes
const dbUrl = env.DATABASE_URL;

// Client-side: Available everywhere but must be prefixed with NEXT_PUBLIC_
const apiUrl = env.NEXT_PUBLIC_API_URL;
```

## Configuration

Environment variables are configured through `.env` files:

1. Create a `.env` file at the root of the project for global variables
2. Create app-specific `.env` files in the respective app directories

Example `.env` files are provided in `.env.example` files throughout the project.

## Adding New Environment Variables

To add new environment variables:

1. Add the variable to the appropriate schema in `packages/env/src/index.ts` (server-side) or `packages/env/src/next/index.ts` (Next.js)
2. Rebuild the environment package:
   ```bash
   cd packages/env
   pnpm build
   ```
3. Update the `.env.example` files to document the new variable

## Environment Variable Structure

### Server Environment Variables

These are defined in `packages/env/src/index.ts` and include:

- Database configuration (`DATABASE_URL`, `POSTGRES_*`, etc.)
- Application settings (`NODE_ENV`, `PORT`, `HOST`, etc.)

### Next.js Environment Variables

These are defined in `packages/env/src/next/index.ts` and include:

- Server-side variables (only available in server components)
- Client-side variables (prefixed with `NEXT_PUBLIC_` and available everywhere)

## Best Practices

1. Always use the validated `env` object instead of accessing `process.env` directly
2. Keep sensitive information in server-side variables only
3. Prefix client-side variables with `NEXT_PUBLIC_`
4. Document all environment variables in `.env.example` files
5. Use optional variables when appropriate (`z.string().optional()`) to avoid unnecessary errors
