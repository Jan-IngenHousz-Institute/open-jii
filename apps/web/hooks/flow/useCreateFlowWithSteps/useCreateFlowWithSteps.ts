import { tsr } from "@/lib/tsr";

import type { FlowWithGraph } from "@repo/api";

interface CreateFlowWithStepsProps {
  onSuccess?: (flowWithGraph: FlowWithGraph) => void;
}

export const useCreateFlowWithSteps = (props: CreateFlowWithStepsProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.flows.createFlowWithSteps.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["flows"] });

      // Get the current flows
      const previousFlows = queryClient.getQueryData<{
        body: FlowWithGraph[];
      }>(["flows"]);

      // Return the previous flows to use in case of error
      return { previousFlows };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousFlows) {
        queryClient.setQueryData(["flows"], context.previousFlows);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["flows"],
      });
    },
    onSuccess: (data) => {
      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
