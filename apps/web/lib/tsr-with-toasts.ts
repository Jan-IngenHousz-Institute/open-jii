import { toast } from "@repo/ui/hooks";
import { tsr } from "./tsr";
import type { UseMutationOptions } from "@tanstack/react-query";

/**
 * Extract error message from various error response formats
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return "An error occurred";
  
  // Handle string errors
  if (typeof error === "string") return error;
  
  // Handle object errors
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    
    // Check for direct message property
    if (typeof err.message === "string") {
      return err.message;
    }
    
    // Check for message in body
    if (err.body && typeof err.body === "object") {
      const body = err.body as Record<string, unknown>;
      if (typeof body.message === "string") {
        return body.message;
      }
    }
    
    // Check for status code
    if (typeof err.status === "number") {
      return `Request failed with status ${err.status}`;
    }
  }
  
  return "An error occurred";
}

/**
 * A wrapper function for mutation options that adds toast notifications for errors
 */
export function withToastError<TData = unknown, TError = unknown, TVariables = unknown, TContext = unknown>(
  options?: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationOptions<TData, TError, TVariables, TContext> {
  const originalOptions = options ?? {} as UseMutationOptions<TData, TError, TVariables, TContext>;
  const originalOnError = originalOptions.onError;
  
  return {
    ...originalOptions,
    onError: (error, variables, context) => {
      // Show error toast
      toast({
        variant: "destructive",
        title: "Error",
        description: extractErrorMessage(error),
      });
      
      // Call original onError if provided
      if (originalOnError) {
        originalOnError(error, variables, context);
      }
    },
  };
}

/**
 * A type-safe Proxy-based implementation that adds toast notifications to all TSR mutations.
 * This approach allows it to handle any new endpoints without requiring code changes.
 * 
 * This handles the TSR client's nested structure, where endpoints are accessed via:
 * tsr.endpoint.action.useMutation()
 */
type TsrClient = typeof tsr;

/**
 * Type for a generic mutation function that accepts options and returns a mutation result.
 * This helps maintain type safety when wrapping mutation functions.
 */
type MutationFunction = <TData, TError, TVariables, TContext>(
  options?: UseMutationOptions<TData, TError, TVariables, TContext>
) => unknown;

/**
 * Creates a proxy-based wrapper around TSR that automatically adds toast notifications
 * for all mutation errors. This is the main export that should be used in place of the
 * regular tsr client to get automatic toast notifications.
 * 
 * @example
 * // Instead of:
 * import { tsr } from "@/lib/tsr";
 * 
 * // Use:
 * import { tsrWithToasts as tsr } from "@/lib/tsr-with-toasts";
 */
export const tsrWithToasts: TsrClient = new Proxy({} as TsrClient, {
  get(_, prop: string | symbol): unknown {
    // Direct passthrough of certain utilities to ensure they work exactly as before
    if (prop === 'useQueryClient' || prop === 'useQueries' || prop === 'ReactQueryProvider') {
      return tsr[prop as keyof TsrClient];
    }
    
    // For endpoints and other properties, create nested proxies
    const originalValue = tsr[prop as keyof TsrClient];
    
    // Handle objects with nested proxies
    if (originalValue !== null && typeof originalValue === 'object') {
      return createNestedProxy(originalValue);
    }
    
    // Return any non-object value directly
    return originalValue;
  }
});

/**
 * Helper function to create nested proxies for endpoint groups.
 * This recursively wraps all nested objects and enhances useMutation functions.
 * 
 * @param obj - The object to wrap with a proxy
 * @returns A proxied version of the object with enhanced mutation functions
 */
function createNestedProxy<T extends object>(obj: T): T {
  return new Proxy({} as T, {
    get(_, prop: string | symbol): unknown {
      const value = obj[prop as keyof T];
      
      // Special case: enhance useMutation functions with toast notifications
      if (prop === 'useMutation' && typeof value === 'function') {
        // Return an enhanced version of the useMutation function
        return function useMutationWithToast<TData, TError, TVariables, TContext>(
          options?: UseMutationOptions<TData, TError, TVariables, TContext>
        ) {
          // Add toast notifications to the options and call the original function
          const mutationFn = value as MutationFunction;
          return mutationFn(withToastError(options));
        };
      }
      
      // For nested objects, create another proxy layer to handle deeper nesting
      if (value !== null && typeof value === 'object') {
        return createNestedProxy(value);
      }
      
      // Return non-object values directly without modification
      return value;
    }
  });
}

/**
 * Test function to verify the toast functionality works correctly
 * This can be used for manual testing or unit tests
 */
export function testToastError(error: unknown): string {
  const message = extractErrorMessage(error);
  toast({
    variant: "destructive",
    title: "Error",
    description: message,
  });
  return message;
}
