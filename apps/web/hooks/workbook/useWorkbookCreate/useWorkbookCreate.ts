import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks";

import { getContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

const route = tsr.workbooks.createWorkbook;

export type UseWorkbookCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError"
>;

export function useWorkbookCreate(options?: UseWorkbookCreateOptions) {
  const queryClient = tsr.useQueryClient();
  const { t } = useTranslation(["workbook", "common"]);

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: ["workbooks"] });
      toast({ description: t("workbooks.workbookCreated") });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      const contractError = getContractError(route, error);

      if (!contractError) {
        toast({ description: t("common.errors.serverError"), variant: "destructive" });
        return;
      }

      toast({ description: t("workbooks.createError"), variant: "destructive" });
      options?.onError?.(contractError, ...rest);
    },
  });
}
