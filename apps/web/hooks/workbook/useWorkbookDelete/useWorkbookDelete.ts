import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

export const useWorkbookDelete = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.workbooks.deleteWorkbook.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: orpc.workbooks.listWorkbooks.key() });

        queryClient.removeQueries({
          queryKey: orpc.workbooks.getWorkbook.queryKey({ input: { id: variables.id } }),
        });
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.workbooks.listWorkbooks.key() });
      },
    }),
  );
};
