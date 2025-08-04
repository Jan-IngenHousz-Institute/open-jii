import { tsr } from "@/lib/tsr";

import type { FlowWithGraph } from "@repo/api";

interface UpdateFlowWithStepsProps {
  flowId: string;
  onSuccess?: (flowWithGraph: FlowWithGraph) => void;
  onError?: (error: unknown) => void;
}

export const useUpdateFlowWithSteps = (props: UpdateFlowWithStepsProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.flows.updateFlowWithSteps.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["flows", props.flowId] });

      // Get the current flow
      const previousFlow = queryClient.getQueryData<{
        body: FlowWithGraph;
      }>(["flows", props.flowId]);

      // Return the previous flow to use in case of error
      return { previousFlow };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousFlow) {
        queryClient.setQueryData(["flows", props.flowId], context.previousFlow);
      }

      // Call the provided onError callback if it exists
      if (props.onError) {
        props.onError(error);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["flows", props.flowId],
      });
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
