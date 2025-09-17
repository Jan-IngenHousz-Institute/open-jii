import type { Macro } from "@repo/api";

import { tsr } from "../../../lib/tsr";

interface MacroUpdateProps {
  onSuccess?: (macro: Macro) => void;
}

/**
 * Hook to update an existing macro
 * @param macroId The ID of the macro to update
 * @param props Optional callbacks and configuration
 * @returns Mutation result for updating a macro
 */
export const useMacroUpdate = (macroId: string, props: MacroUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.updateMacro.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwrites
      await queryClient.cancelQueries({
        queryKey: ["macro", macroId],
      });
      await queryClient.cancelQueries({
        queryKey: ["macros"],
      });

      // Get the current macro data
      const previousMacro = queryClient.getQueryData<{
        body: Macro;
      }>(["macro", macroId]);

      // Optimistically update the cache
      if (previousMacro) {
        queryClient.setQueryData(["macro", macroId], {
          ...previousMacro,
          body: {
            ...previousMacro.body,
            ...variables.body,
          },
        });
      }

      // Also update in any macro lists in the cache
      const macrosKey = ["macros"];
      const previousMacros = queryClient.getQueryData<{
        body: Macro[];
      }>(macrosKey);

      if (previousMacros?.body) {
        queryClient.setQueryData(macrosKey, {
          ...previousMacros,
          body: previousMacros.body.map((macro) =>
            macro.id === macroId ? { ...macro, ...variables.body } : macro,
          ),
        });
      }

      return { previousMacro, previousMacros };
    },
    onError: (error, variables, context) => {
      // Revert updates on error
      if (context?.previousMacro) {
        queryClient.setQueryData(["macro", macroId], context.previousMacro);
      }

      if (context?.previousMacros) {
        queryClient.setQueryData(["macros"], context.previousMacros);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success
      await queryClient.invalidateQueries({
        queryKey: ["macro", macroId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["macros"],
      });
    },
    onSuccess: (data) => {
      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
