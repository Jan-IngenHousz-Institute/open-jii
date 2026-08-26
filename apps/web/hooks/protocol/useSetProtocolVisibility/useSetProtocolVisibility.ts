import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Publishes a protocol (private → public). See `useSetMacroVisibility` for why
 * this is a dedicated one-way route and why the invalidation reaches the scoped
 * lists and global search as well as the protocol itself.
 */
export const useSetProtocolVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.protocols.setVisibility.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.protocols.getProtocol.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        for (const queryKey of listQueryKeys.protocols()) {
          await queryClient.invalidateQueries({ queryKey });
        }
        await queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() });
      },
    }),
  );
};
