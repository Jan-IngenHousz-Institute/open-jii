import { tsr } from "../../../providers/QueryProvider";

export const useTaskDelete = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.deleteTask.useMutation({
    onMutate: async ({ params }: { params: { id: string } }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const previousTasks = queryClient.getQueryData<{ body: Task[] }>([
        "tasks",
      ]);

      queryClient.setQueryData(
        ["tasks"],
        (oldTasks: { body: GetTasksResponse } | undefined) => {
          if (!oldTasks) return oldTasks;

          return {
            ...oldTasks,
            body: oldTasks.body.filter((task) => task.id !== params.id),
          };
        },
      );

      return { previousTasks };
    },
    onError: (error, _, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};
