import { tsr } from "@/lib/tsr";

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
  return tsr.experiments.createFlow.useMutation({
    onSuccess: (data: unknown) => options?.onSuccess?.(data),
    onError: (error: unknown) => options?.onError?.(error),
  });
};
