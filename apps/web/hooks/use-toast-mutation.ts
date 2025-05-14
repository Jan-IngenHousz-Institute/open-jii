import { toast } from "@repo/ui/hooks";
import type { ErrorResponse } from "@ts-rest/react-query/v5";

/**
 * A higher-order function that adds automatic error toast functionality to TSR mutations
 * 
 * @param mutationFn The original mutation function from TSR
 * @returns A wrapped mutation function that shows error toasts
 */
export function createAutoToastMutation<T extends (...args: any[]) => any>(
  mutationFn: T
) {
  type MutationOpts = Parameters<T>[0];
  
  return function(opts?: MutationOpts): ReturnType<T> {
    const originalOpts = opts || {} as MutationOpts;
    const originalOnError = originalOpts.onError;
    
    const enhancedOpts = {
      ...originalOpts,
      onError: (error: TSRError<unknown>, ...rest: any[]) => {
        // Extract the error message
        let errorMessage = "An error occurred";
        
        if (error && typeof error === "object") {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message;
          } else if (
            "body" in error && 
            error.body && 
            typeof error.body === "object" && 
            "message" in error.body && 
            typeof error.body.message === "string"
          ) {
            errorMessage = error.body.message;
          } else if (error.status) {
            errorMessage = `Error ${error.status}: ${errorMessage}`;
          }
        }
        
        // Show toast notification
        toast({
          variant: "destructive", 
          title: "Error",
          description: errorMessage,
        });
        
        // Call original onError if it exists
        if (originalOnError) {
          originalOnError(error, ...rest);
        }
      },
    };
    
    return mutationFn(enhancedOpts as MutationOpts);
  };
}

/**
 * Factory that creates toast mutation hooks for TSR endpoints
 * 
 * @example
 * ```typescript
 * // Create a hook for a specific endpoint
 * export const useExperimentCreateWithToast = createTsrToastMutation(
 *   tsr.experiments.createExperiment.useMutation
 * );
 * 
 * // Use the hook in components
 * const mutation = useExperimentCreateWithToast({
 *   onSuccess: (data) => {
 *     // Handle success
 *   }
 * });
 * ```
 */
export function createTsrToastMutation<T extends (...args: any[]) => any>(
  useMutationHook: T
) {
  return createAutoToastMutation(useMutationHook);
}
