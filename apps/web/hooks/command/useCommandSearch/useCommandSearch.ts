import type { Command } from "@repo/api/schemas/command.schema";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a list of commands with optional search functionality
 * @param search Search term (controlled externally)
 * @returns Query result containing the commands list
 */

interface useCommandSearchResult {
  commands: Command[] | undefined;
  isLoading: boolean;
  error: unknown;
}

export const useCommandSearch = (search = ""): useCommandSearchResult => {
  const { data, isLoading, error } = tsr.commands.listCommands.useQuery({
    queryData: {
      query: { search: search || undefined },
    },
    queryKey: ["commands", search],
  });

  return {
    commands: data?.body,
    isLoading: isLoading,
    error,
  };
};
