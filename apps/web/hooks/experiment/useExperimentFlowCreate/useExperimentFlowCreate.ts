import type { UseMutationOptions } from "@tanstack/react-query";
import { tsr } from "@/lib/tsr";

interface UseExperimentFlowCreateOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * Hook to create a flow for a specific experiment
 * @param options Mutation options
 * @returns Mutation object for creating experiment flow
 */
export const useExperimentFlowCreate = (options?: UseExperimentFlowCreateOptions) => {
  return tsr.experiments.createFlow.useMutation({
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  } as UseMutationOptions);
};