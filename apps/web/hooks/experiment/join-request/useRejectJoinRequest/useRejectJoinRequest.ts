import { tsr } from "@/lib/tsr";

/**
 * Admin mutation: rejects a pending join request.
 */
export const useRejectJoinRequest = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.rejectJoinRequest.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-join-requests"] });
    },
  });
};
