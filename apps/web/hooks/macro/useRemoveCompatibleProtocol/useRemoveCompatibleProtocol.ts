import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/**
 * Hook to remove a compatible protocol from a macro
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useRemoveCompatibleProtocol = (macroId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.macros.removeCompatibleProtocol.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.macros.listCompatibleProtocols.queryKey({ input: { id: macroId } }),
        });
      },
    }),
  );
};
