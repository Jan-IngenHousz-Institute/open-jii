import { tsr } from "@/lib/tsr";

import type { TransferRequest } from "@repo/api";

interface TransferRequestCreateProps {
  onSuccess?: (requestId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to create a new transfer request
 * @param props Optional callbacks and configuration
 * @returns Mutation result for creating a transfer request
 */
export const useTransferRequestCreate = (props?: TransferRequestCreateProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.createTransferRequest.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["transferRequests"] });

      // Get the current transfer requests
      const previousRequests = queryClient.getQueryData<TransferRequest[]>(["transferRequests"]);

      // Return the previous requests to use in case of error
      return { previousRequests };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousRequests) {
        queryClient.setQueryData(["transferRequests"], context.previousRequests);
      }

      // Call the provided onError callback if it exists
      props?.onError?.(error as Error);
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["transferRequests"],
      });
    },
    onSuccess: (data) => {
      // Call the provided onSuccess callback if it exists
      props?.onSuccess?.(data.body.requestId);
    },
  });
};
