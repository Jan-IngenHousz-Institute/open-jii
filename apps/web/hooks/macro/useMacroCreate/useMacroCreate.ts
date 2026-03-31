import { toast } from "@repo/ui/hooks";
import { isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";
import { t } from "@repo/i18n";

const route = tsr.macros.createMacro;

export type UseMacroCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError"
>;

export function useMacroCreate(options?: UseMacroCreateOptions) {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["macros"] });
      toast({ description: t("macros.macroCreated") });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      if (!isContractError(error)) return;

      switch(error.status) {
        case 409:
          toast({ description: t("macros.nameAlreadyExists"), variant: "destructive" });
          break;
        default:
        case 400:
          toast({ description: t("macros.createError"), variant: "destructive" });
          break;
      }
    },
  });
}
