import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

interface UseExperimentFlowUpdateOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook to update a flow for a specific experiment
 * @param options Mutation options
 * @returns Mutation object for updating experiment flow
 */
export const useExperimentFlowUpdate = (options?: UseExperimentFlowUpdateOptions) => {
  return useMutation(
    orpc.experiments.updateFlow.mutationOptions({
      onSuccess: (data) => options?.onSuccess?.(data),
      onError: (error) => options?.onError?.(error),
    }),
  );
};
