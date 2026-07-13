import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a single command by ID
 * @param commandId The ID of the command to fetch
 * @returns Query result containing the command details
 */
export const useCommand = (commandId: string, enabled = true) => {
  return tsr.commands.getCommand.useQuery({
    queryData: { params: { id: commandId } },
    queryKey: ["command", commandId],
    retry: shouldRetryQuery,
    enabled: enabled && !!commandId,
  });
};
