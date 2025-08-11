import { tsr } from "@/lib/tsr";

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
  return tsr.experiments.updateFlow.useMutation({
    onSuccess: (data) => options?.onSuccess?.(data),
    onError: (error) => options?.onError?.(error),
  });
};
