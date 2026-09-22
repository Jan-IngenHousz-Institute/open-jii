import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to delete a macro
 * @returns Mutation object for deleting macros
 */
export const useMacroDelete = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.macros.deleteMacro.mutationOptions({
      onMutate: async (variables) => {
        for (const queryKey of listQueryKeys.macros()) {
          await queryClient.cancelQueries({ queryKey });
        }

        queryClient.removeQueries({
          queryKey: orpc.macros.getMacro.queryKey({ input: { id: variables.id } }),
        });
      },
      onSettled: async () => {
        for (const queryKey of listQueryKeys.macros()) {
          await queryClient.invalidateQueries({ queryKey });
        }
      },
    }),
  );
};
