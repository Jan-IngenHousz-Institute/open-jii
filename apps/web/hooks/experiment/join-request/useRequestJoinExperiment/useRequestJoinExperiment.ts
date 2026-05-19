import { tsr } from "@/lib/tsr";

/**
 * Submits a join request for the signed-in user.
 * Invalidates the "my join request" query so the UI updates immediately.
 */
export const useRequestJoinExperiment = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.createJoinRequest.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-join-request-mine"] });
    },
  });
};
