import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useWorkbookDelete = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workbooks.deleteWorkbook.mutationOptions({
      onMutate: async (variables) => {
        for (const queryKey of listQueryKeys.workbooks()) {
          await queryClient.cancelQueries({ queryKey });
        }

        queryClient.removeQueries({
          queryKey: orpc.workbooks.getWorkbook.queryKey({ input: { id: variables.id } }),
        });
      },
      onSettled: async () => {
        for (const queryKey of listQueryKeys.workbooks()) {
          await queryClient.invalidateQueries({ queryKey });
        }
      },
    }),
  );
};
