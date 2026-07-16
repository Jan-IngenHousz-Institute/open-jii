import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

interface UseExperimentFlowCreateOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
}

/**
 * Hook to create a flow for a specific experiment
 * @param options Mutation options
 * @returns Mutation object for creating experiment flow
 */
export const useExperimentFlowCreate = (options?: UseExperimentFlowCreateOptions) => {
  return useMutation(
    orpc.experiments.createFlow.mutationOptions({
      onSuccess: (data) => options?.onSuccess?.(data),
      onError: (error) => options?.onError?.(error),
    }),
  );
};
