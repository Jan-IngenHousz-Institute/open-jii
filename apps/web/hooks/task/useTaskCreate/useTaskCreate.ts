export const useTaskCreate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.createTask.useMutation({
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const previousTasks = queryClient.getQueryData<{
        body: { id: string; title: string; completed: boolean }[];
      }>(["tasks"]);

      queryClient.setQueryData(
        ["tasks"],
        (oldTasks: { body: CreateTaskResponse[] }) => {
          if (!oldTasks) return oldTasks;

          return {
            ...oldTasks,
            body: [
              ...oldTasks.body,
              {
                id: `temp-${Date.now()}`, // Temporary ID
                ...newTask.body,
                completed: false,
              },
            ],
          };
        },
      );

      return { previousTasks };
    },
    onError: (error, newTask, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
};
