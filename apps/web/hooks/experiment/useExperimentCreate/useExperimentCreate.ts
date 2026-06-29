import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

interface ExperimentCreateProps {
  onSuccess?: (id: string) => void;
}

export const useExperimentCreate = (props: ExperimentCreateProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.createExperiment.mutationOptions({
      onMutate: async () => {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey: orpc.experiments.listExperiments.key() });
      },
      onSettled: async () => {
        // Always refetch after error or success to make sure cache is in sync with server
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperiments.key(),
        });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data.id);
      },
    }),
  );
};
