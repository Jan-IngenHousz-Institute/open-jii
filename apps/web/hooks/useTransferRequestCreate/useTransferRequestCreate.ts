import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.createTransferRequest.mutationOptions({
      onMutate: async () => {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({
          queryKey: orpc.experiments.listTransferRequests.key(),
        });

        // Get the current transfer requests
        const previousRequests = queryClient.getQueryData(
          orpc.experiments.listTransferRequests.queryKey({ input: {} }),
        );

        // Return the previous requests to use in case of error
        return { previousRequests };
      },
      onError: (error, _variables, context) => {
        // If there was an error, revert to the previous state
        if (context?.previousRequests) {
          queryClient.setQueryData(
            orpc.experiments.listTransferRequests.queryKey({ input: {} }),
            context.previousRequests,
          );
        }

        // Call the provided onError callback if it exists
        props?.onError?.(error);
      },
      onSettled: async () => {
        // Always refetch after error or success to make sure cache is in sync with server
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listTransferRequests.key(),
        });
      },
      onSuccess: (data) => {
        // Call the provided onSuccess callback if it exists
        props?.onSuccess?.(data.requestId);
      },
    }),
  );
};
