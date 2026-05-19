import { tsr } from "@/lib/tsr";

/**
 * Admin mutation: approves a pending join request and adds the requester as a member.
 */
export const useApproveJoinRequest = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.approveJoinRequest.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-join-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["experiment-members"] });
    },
  });
};
