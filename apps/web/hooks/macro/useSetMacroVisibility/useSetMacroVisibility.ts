import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Publishes a macro (private → public) via the dedicated one-way `setVisibility`
 * route. Mirrors `useSetExperimentVisibility`: the update path deliberately does
 * not carry `visibility`, because publishing is an irreversible capability
 * distinct from editing content.
 *
 * Invalidation is wider than the resource itself: the list and global-search
 * queries are scoped by visibility, so publishing changes *what is listed* for
 * other users, not just this macro's own state.
 */
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
