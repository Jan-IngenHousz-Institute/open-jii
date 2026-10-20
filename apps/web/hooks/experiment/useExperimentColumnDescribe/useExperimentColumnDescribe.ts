import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Saves a column's description, then refreshes the experiment's data dictionary. */
export const useExperimentColumnDescribe = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.describeColumn.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getColumnDictionary.queryKey({
            input: { id: variables.id },
          }),
        });
      },
    }),
  );
};
