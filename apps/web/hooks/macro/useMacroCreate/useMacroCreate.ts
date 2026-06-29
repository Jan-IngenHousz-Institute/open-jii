import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { getOrpcError, orpc } from "@/lib/orpc";

export type UseMacroCreateOptions = Pick<
  ReturnType<typeof orpc.macros.createMacro.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

export function useMacroCreate(options: UseMacroCreateOptions = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["macro", "common"]);

  return useMutation(
    orpc.macros.createMacro.mutationOptions({
      onSuccess: (...args) => {
        toast({ description: t("macros.macroCreated") });
        options.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        const contractError = getOrpcError(error);

        if (!contractError) {
          toast({ description: t("common.errors.serverError"), variant: "destructive" });
          return;
        }

        switch (contractError.status) {
          case 409:
            toast({ description: t("macros.nameAlreadyExists"), variant: "destructive" });
            break;
          default:
            toast({ description: t("macros.createError"), variant: "destructive" });
            break;
        }

        options.onError?.(...args);
      },
      onSettled: async (...args) => {
        await queryClient.invalidateQueries({ queryKey: orpc.macros.listMacros.key() });
        options.onSettled?.(...args);
      },
    }),
  );
}
