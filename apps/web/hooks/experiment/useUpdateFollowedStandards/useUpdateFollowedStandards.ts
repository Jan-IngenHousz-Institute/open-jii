import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentStandards } from "@repo/api/domains/experiment/standards/experiment-standards.schema";

/**
 * Saves what an experiment follows. The standards answer already carries every standard's steps,
 * so the saved choice is written into it instead of fetching it again.
 */
export const useUpdateFollowedStandards = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.updateFollowedStandards.mutationOptions({
      onSuccess: (saved, variables) => {
        queryClient.setQueryData<ExperimentStandards>(
          orpc.experiments.getExperimentStandards.queryKey({ input: { id: variables.id } }),
          (current) => (current ? { ...current, followed: saved.followed } : current),
        );
      },
    }),
  );
};
