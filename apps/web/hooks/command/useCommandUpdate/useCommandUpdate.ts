import type { Command } from "@repo/api/schemas/command.schema";

import { tsr } from "../../../lib/tsr";

interface CommandUpdateProps {
  onSuccess?: (command: Command) => void;
}

/**
 * Hook to update an existing command
 * @param commandId The ID of the command to update
 * @param props Optional callbacks and configuration
 * @returns Mutation result for updating a command
 */
export const useCommandUpdate = (commandId: string, props: CommandUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.commands.updateCommand.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["command", commandId] });
      await queryClient.cancelQueries({ queryKey: ["commands"] });

      // Get the current command
      const previousCommand = queryClient.getQueryData<{
        body: Command;
      }>(["command", commandId]);

      // Return the previous command to use in case of error
      return { previousCommand };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousCommand) {
        queryClient.setQueryData(["command", commandId], context.previousCommand);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["command", commandId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["commands"],
      });
      // Editing shared command code changes workbook drift; refetch so an
      // attached experiment's upgrade prompt reacts immediately.
      await queryClient.invalidateQueries({
        queryKey: ["workbook"],
      });
    },
    onSuccess: (data) => {
      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
