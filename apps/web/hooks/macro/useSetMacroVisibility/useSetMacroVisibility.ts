import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Publishes a macro and refreshes visibility-scoped detail, list, and search caches. */
export const useSetMacroVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.macros.setVisibility.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.macros.getMacro.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        await queryClient.invalidateQueries({ queryKey: orpc.macros.listMacros.key() });
        await queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() });
      },
    }),
  );
};
