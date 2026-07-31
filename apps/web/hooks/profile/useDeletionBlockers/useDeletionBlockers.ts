import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Fetches sole-admin deletion blockers and their transfer candidates. */
export const useDeletionBlockers = (userId: string, options?: { enabled?: boolean }) => {
  return useQuery(
    orpc.users.getDeletionBlockers.queryOptions({
      input: { id: userId },
      enabled: (options?.enabled ?? true) && userId.length > 0,
    }),
  );
};
