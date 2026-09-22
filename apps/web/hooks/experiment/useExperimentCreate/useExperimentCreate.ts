import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ExperimentCreateProps {
  onSuccess?: (id: string) => void;
}

export const useExperimentCreate = (props: ExperimentCreateProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.createExperiment.mutationOptions({
      onMutate: async () => {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        for (const queryKey of listQueryKeys.experiments()) {
          await queryClient.cancelQueries({ queryKey });
        }
      },
      onSettled: async () => {
        // Always refetch after error or success to make sure cache is in sync with server
        for (const queryKey of listQueryKeys.experiments()) {
          await queryClient.invalidateQueries({ queryKey });
        }
      },
      onSuccess: (data) => {
        props.onSuccess?.(data.id);
      },
    }),
  );
};
