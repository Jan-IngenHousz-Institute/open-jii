import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to add compatible protocols to a macro
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useAddCompatibleProtocol = (macroId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.macros.addCompatibleProtocols.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.macros.listCompatibleProtocols.queryKey({ input: { id: macroId } }),
        });
      },
    }),
  );
};
