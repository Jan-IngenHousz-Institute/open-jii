import { useRouter } from "next/navigation";

import type { Macro } from "@repo/api";

import { tsr } from "../../../lib/tsr";
import { useLocale } from "../../useLocale";

interface MacroUpdateProps {
  onSuccess?: (macro: Macro) => void;
}

/**
 * Hook to update an existing macro.
 * Updates create a new version (new UUID), so the hook redirects to the new version's page.
 */
export const useMacroUpdate = (macroId: string, props: MacroUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();
  const router = useRouter();
  const locale = useLocale();

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
      // Invalidate version history cache
      await queryClient.invalidateQueries({
        queryKey: ["macro-versions"],
      });
      // Invalidate breadcrumbs to update entity names
      await queryClient.invalidateQueries({
        queryKey: ["breadcrumbs"],
      });
    },
    onSuccess: (data) => {
      const newMacro = data.body;
      // Redirect to the new version's page if the ID changed
      if (newMacro.id !== macroId) {
        router.replace(`/${locale}/platform/macros/${newMacro.id}`);
      }
      if (props.onSuccess) {
        props.onSuccess(newMacro);
      }
    },
  });
};
