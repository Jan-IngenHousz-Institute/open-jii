import type { Macro } from "@repo/api";

import { tsr } from "../../../lib/tsr";

interface MacroUpdateProps {
  onSuccess?: (macro: Macro) => void;
}

/**
 * Hook to update an existing macro.
 * Updates create a new version with the same UUID — URL stays stable.
 */
export const useMacroUpdate = (macroId: string, props: MacroUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.updateMacro.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["macro", macroId] });
      await queryClient.cancelQueries({ queryKey: ["macros"] });

      const previousMacro = queryClient.getQueryData<{ body: Macro }>(["macro", macroId]);

      if (previousMacro) {
        queryClient.setQueryData(["macro", macroId], {
          ...previousMacro,
          body: { ...previousMacro.body, ...variables.body },
        });
      }

      const macrosKey = ["macros"];
      const previousMacros = queryClient.getQueryData<{ body: Macro[] }>(macrosKey);

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
      if (context?.previousMacro) {
        queryClient.setQueryData(["macro", macroId], context.previousMacro);
      }
      if (context?.previousMacros) {
        queryClient.setQueryData(["macros"], context.previousMacros);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["macro", macroId] });
      await queryClient.invalidateQueries({ queryKey: ["macros"] });
      await queryClient.invalidateQueries({ queryKey: ["macro-versions"] });
      await queryClient.invalidateQueries({ queryKey: ["breadcrumbs"] });
    },
    onSuccess: (data) => {
      // URL stays stable (same UUID), just refetch shows the new version
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
