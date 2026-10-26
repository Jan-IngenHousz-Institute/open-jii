import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Creates a version from the workbook's current draft. The workbook is refetched
 * because its `isUpgradable` flag turns false once the new version matches the draft.
 */
export const usePublishWorkbookVersion = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workbooks.publishWorkbookVersion.mutationOptions({
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
};
