import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Publishes an experiment and invalidates its detail, access, and list caches. */
export const useSetExperimentVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.setVisibility.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentAccess.queryKey({ input: { id: variables.id } }),
        });
        for (const queryKey of listQueryKeys.experiments()) {
          await queryClient.invalidateQueries({ queryKey });
        }
      },
    }),
  );
};
