import type { Command } from "@repo/api/schemas/command.schema";

import { tsr } from "../../../lib/tsr";

interface CommandDeleteProps {
  onSuccess?: () => void;
}

/**
 * Hook to delete a command
 * @param commandId The ID of the command to delete
 * @param props Optional callbacks and configuration
 * @returns Mutation result for deleting a command
 */
export const useCommandDelete = (commandId: string, props: CommandDeleteProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.commands.deleteCommand.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["commands"] });

      // Get the current commands
      const previousCommands = queryClient.getQueryData<{
        body: Command[];
      }>(["commands"]);

      // Optimistically remove the command from the list
      if (previousCommands?.body) {
        queryClient.setQueryData(["commands"], {
          ...previousCommands,
          body: previousCommands.body.filter((command) => command.id !== commandId),
        });
      }

      // Return the previous commands to use in case of error
      return { previousCommands };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousCommands) {
        queryClient.setQueryData(["commands"], context.previousCommands);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["commands"],
      });
    },
    onSuccess: () => {
      // Remove the deleted command from the cache
      queryClient.removeQueries({
        queryKey: ["command", commandId],
      });

      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess();
      }
    },
  });
};
