import { tsr } from "@/lib/tsr";

/**
 * Cancels the signed-in user's pending join request.
 */
export const useCancelMyJoinRequest = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.cancelJoinRequest.useMutation({
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["experiment-join-request-mine"] });
    },
  });
};
