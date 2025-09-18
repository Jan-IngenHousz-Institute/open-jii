import type { Macro } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to delete a macro
 * @returns Mutation object for deleting macros
 */
export const useMacroDelete = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.deleteMacro.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["macros"],
      });

      // Get the current macros list
      const previousMacros = queryClient.getQueryData<{
        body: Macro[];
      }>(["macros"]);

      // Optimistically remove the macro from the list
      if (previousMacros?.body) {
        queryClient.setQueryData(["macros"], {
          ...previousMacros,
          body: previousMacros.body.filter((macro) => macro.id !== variables.params.id),
        });
      }

      // Remove the single macro from cache as well
      queryClient.removeQueries({
        queryKey: ["macro", variables.params.id],
      });

      return { previousMacros };
    },
    onError: (error, variables, context) => {
      // Restore the previous data if there was an error
      if (context?.previousMacros) {
        queryClient.setQueryData(["macros"], context.previousMacros);
      }
    },
    onSettled: async () => {
      // Always invalidate to ensure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["macros"],
      });
    },
  });
};
