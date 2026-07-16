import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Macro } from "@repo/api/domains/macro/macro.schema";

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
  const queryClient = useQueryClient();
  const macroKey = orpc.macros.getMacro.queryKey({ input: { id: macroId } });

  return useMutation(
    orpc.macros.updateMacro.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: macroKey });
        await queryClient.cancelQueries({ queryKey: orpc.macros.listMacros.key() });

        const previousMacro = queryClient.getQueryData(macroKey);
        return { previousMacro };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousMacro) {
          queryClient.setQueryData(macroKey, context.previousMacro);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: macroKey });
        await queryClient.invalidateQueries({ queryKey: orpc.macros.listMacros.key() });
        // Editing shared macro code changes workbook drift; refetch so an attached
        // experiment's upgrade prompt reacts immediately.
        await queryClient.invalidateQueries({ queryKey: orpc.workbooks.key() });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
