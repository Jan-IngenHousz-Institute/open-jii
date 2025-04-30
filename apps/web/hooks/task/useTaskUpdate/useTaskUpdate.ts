import { tsr } from "../../../providers/QueryProvider";

export const useTaskUpdate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.updateTask.useMutation({
    onMutate: async (variables: {
      params: { id: string };
      body?: { title?: string; completed?: boolean };
    }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const previousTasks = queryClient.getQueryData<{ body: Task[] }>([
        "tasks",
      ]);

      queryClient.setQueryData(
        ["tasks"],
        (oldTasks: { body: GetTasksResponse }) => {
          if (!oldTasks) return oldTasks;

          return {
            ...oldTasks,
            body: oldTasks.body.map((task) =>
              task.id === variables.params.id
                ? { ...task, ...variables.body }
                : task,
            ),
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
