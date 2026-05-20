import { tsr } from "@/lib/tsr";

/**
 * Submits a join request for the signed-in user.
 * Invalidates the "my join request" query so the UI updates immediately.
 */
export const useRequestJoinExperiment = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.createJoinRequest.useMutation({
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-join-request-mine"] });
      await queryClient.invalidateQueries({
        queryKey: ["experiment-join-requests", variables.params.id],
      });
    },
  });
};
