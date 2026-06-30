import { getOrpcError, orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseWorkbookCreateOptions = Pick<
  ReturnType<typeof orpc.workbooks.createWorkbook.mutationOptions>,
  "onSuccess" | "onError"
>;

export function useWorkbookCreate(options: UseWorkbookCreateOptions = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["workbook", "common"]);

  return useMutation(
    orpc.workbooks.createWorkbook.mutationOptions({
      onSuccess: (...args) => {
        void queryClient.invalidateQueries({ queryKey: orpc.workbooks.listWorkbooks.key() });
        // No success toast: creation navigates straight to the new workbook page,
        // so a toast would be redundant noise.
        options.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        const contractError = getOrpcError(error);

        if (!contractError) {
          toast({ description: t("common.errors.serverError"), variant: "destructive" });
          return;
        }

        toast({ description: t("workbooks.createError"), variant: "destructive" });
        options.onError?.(...args);
      },
    }),
  );
}
