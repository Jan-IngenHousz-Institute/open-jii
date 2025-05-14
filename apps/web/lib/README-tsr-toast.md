# TSR with Automatic Toast Notifications

This utility enhances the TSR (TypeScript REST) client by automatically showing toast notifications for any errors that occur during mutations. It uses a Proxy-based approach to intercept all mutation calls without requiring manual configuration for each endpoint.

## Features

- **Automatic Error Toasts**: All TSR mutation errors will display a toast notification
- **Zero Configuration**: No need to update code when adding new API endpoints
- **Type Safety**: Maintains full TypeScript type safety
- **Fallback Behavior**: Gracefully handles different error formats

## Usage

### Option 1: Use the enhanced TSR client directly (Recommended)

Instead of importing `tsr` from `@/lib/tsr`, import `tsrWithToasts` from `@/lib/tsr-with-toasts`:

```typescript
// Before:
import { tsr } from "@/lib/tsr";

// After:
import { tsrWithToasts as tsr } from "@/lib/tsr-with-toasts";

// Use it the same way as the regular tsr client
const mutation = tsr.experiments.createExperiment.useMutation({
  onSuccess: (data) => {
    // Handle success
    console.log("Experiment created:", data);
  },
  // No need to handle errors for toast notifications - they're automatic!
});
```

### Option 2: Use the withToastError utility for specific hooks

For cases where you only want toast notifications on specific endpoints:

```typescript
import { tsr } from "@/lib/tsr";
import { withToastError } from "@/lib/tsr-with-toasts";

export const useExperimentCreate = () => {
  return tsr.experiments.createExperiment.useMutation(
    withToastError({
      onSuccess: (data) => {
        console.log("Success!", data);
      },
      // You can still add custom error handling in addition to the automatic toast
      onError: (error) => {
        // Additional error handling beyond the toast notification
        console.error("Custom error handling:", error);
      }
    })
  );
};
```

## Error Handling

The `extractErrorMessage` utility function handles various error formats:

1. String errors: `"Something went wrong"`
2. Objects with a `message` property: `{ message: "Not found" }`
3. Objects with a nested `body.message` property: `{ body: { message: "Invalid input" } }`
4. Objects with a `status` property: `{ status: 404 }` → "Request failed with status 404"
5. Fallback message: "An error occurred"

## Utility Functions

The module exports these utility functions:

- `extractErrorMessage`: Extracts a human-readable error message from various error formats
- `withToastError`: Enhances mutation options with toast notifications
- `testToastError`: A test helper for manually triggering error toasts

### Testing

You can use the `testToastError` function to verify that error messages are properly displayed:

```typescript
import { testToastError } from "@/lib/tsr-with-toasts";

// For unit tests or debugging
testToastError(new Error("Test error message"));
testToastError({ body: { message: "Nested error message" } });
```

## Migrating Existing Code

For existing code that already handles errors with toasts, you can:

1. Replace imports to use `tsrWithToasts` instead of `tsr`
2. Remove the explicit toast error handling code (to avoid duplicate toasts)
3. Keep any additional error handling logic that's needed beyond toast notifications

This will ensure that all your API mutations have consistent error toast notifications.

## Detailed Migration Guide

### Step 1: Update imports

```typescript
// Before
import { tsr } from "@/lib/tsr";

// After
import { tsrWithToasts as tsr } from "@/lib/tsr-with-toasts";
```

### Step 2: Remove manual toast error handling

```typescript
// Before
return tsr.experiments.create.useMutation({
  onError: (error) => {
    // Complex error message extraction
    let errorMessage = "Failed to create experiment";
    if (error?.body?.message) {
      errorMessage = error.body.message;
    }
    
    // Manual toast
    toast({
      variant: "destructive",
      title: "Error",
      description: errorMessage,
    });
    
    // Other error handling
    console.error(error);
  }
});

// After
return tsr.experiments.create.useMutation({
  onError: (error) => {
    // Only keep additional error handling
    console.error(error);
  }
});
```

### Step 3: Test your changes

Make sure toast notifications appear correctly when API errors occur. You can use the `testToastError` function to manually verify the toast appearance and formatting:

```typescript
import { testToastError } from "@/lib/tsr-with-toasts";

// Test with different error formats
testToastError("Simple error message");
testToastError({ message: "Object with message property" });
testToastError({ body: { message: "Nested message in body" } });
```

## How It Works

The implementation uses JavaScript Proxies to dynamically wrap all TSR mutation functions. When a mutation error occurs, it extracts the error message using a robust algorithm that handles various error formats and displays it as a toast notification.

- Use the enhanced client (`tsrWithToasts`) for most cases to get automatic error handling
- For custom error messages or additional error handling, you can still provide an `onError` callback
- If you need more control, create custom hooks for specific endpoints
