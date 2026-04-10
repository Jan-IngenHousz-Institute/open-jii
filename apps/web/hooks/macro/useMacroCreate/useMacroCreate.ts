import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks";

import { getContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

const route = tsr.macros.createMacro;

export type UseMacroCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError"
>;

export function useMacroCreate(options?: UseMacroCreateOptions) {
  const queryClient = tsr.useQueryClient();
  const { t } = useTranslation(["macro", "common"]);

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["macros"] });
      toast({ description: t("macros.macroCreated") });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      const contractError = getContractError(route, error);

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

      options?.onError?.(contractError, ...rest);
    },
  });
}
