import { tsr } from "@/lib/tsr";
import type { UseMutationOptions } from "@tanstack/react-query";

interface UseExperimentFlowUpdateOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * Hook to update a flow for a specific experiment
 * @param options Mutation options
 * @returns Mutation object for updating experiment flow
 */
export const useExperimentFlowUpdate = (options?: UseExperimentFlowUpdateOptions) => {
  return tsr.experiments.updateFlow.useMutation({
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  } as UseMutationOptions);
};
