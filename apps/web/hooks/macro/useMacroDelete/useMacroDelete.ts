import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/**
 * Hook to delete a macro
 * @returns Mutation object for deleting macros
 */
export const useMacroDelete = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.macros.deleteMacro.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: orpc.macros.listMacros.key() });

        queryClient.removeQueries({
          queryKey: orpc.macros.getMacro.queryKey({ input: { id: variables.id } }),
        });
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.macros.listMacros.key() });
      },
    }),
  );
};
