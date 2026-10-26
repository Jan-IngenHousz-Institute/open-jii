import { getOrpcError, orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UsePublishWorkbookVersionOptions = Pick<
  ReturnType<typeof orpc.workbooks.publishWorkbookVersion.mutationOptions>,
  "onSuccess" | "onError"
>;

/**
 * Creates a version from the workbook's current draft. The workbook is refetched
 * because its `isUpgradable` flag turns false once the new version matches the draft.
 */
export function usePublishWorkbookVersion(options: UsePublishWorkbookVersionOptions = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["workbook", "common"]);

  return useMutation(
    orpc.workbooks.publishWorkbookVersion.mutationOptions({
      onSuccess: (...args) => {
        const [published] = args;
        toast({ description: t("workbooks.versionPublished", { version: published.version }) });
        options.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        toast({
          description: getOrpcError(error)
            ? t("workbooks.publishVersionFailed")
            : t("common.errors.serverError"),
          variant: "destructive",
        });
        options.onError?.(...args);
      },
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.workbooks.getWorkbook.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.workbooks.listWorkbookVersions.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
      },
    }),
  );
}
