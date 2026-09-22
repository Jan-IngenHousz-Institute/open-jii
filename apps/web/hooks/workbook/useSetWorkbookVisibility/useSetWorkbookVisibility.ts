import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Publishes a workbook (private → public). See `useSetMacroVisibility` for why
 * this is a dedicated one-way route and why the invalidation reaches the scoped
 * lists and global search as well as the workbook itself.
 */
export const useSetWorkbookVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workbooks.setVisibility.mutationOptions({
      onSettled: async (_data, _error, variables) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.workbooks.getWorkbook.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        for (const queryKey of listQueryKeys.workbooks()) {
          await queryClient.invalidateQueries({ queryKey });
        }
        await queryClient.invalidateQueries({ queryKey: orpc.search.globalSearch.key() });
      },
    }),
  );
};
