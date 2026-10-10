import { usePrincipal } from "@/components/auth/principal-context";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { experimentAccessQuery } from "./experiment-access-query";

/**
 * Access answers are principal-specific, so the key includes the user and fetching
 * waits for session resolution; otherwise a new user could briefly receive cached
 * capabilities from the previous one. Expose `isPending` as loading because React
 * Query's `isLoading` is false while disabled, which would flash not-found first.
 */
export const useExperimentAccess = (experimentId: string) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  const query = useQuery({
    ...experimentAccessQuery(orpc, userId, experimentId),
    enabled: !isSessionPending,
  });

  return { ...query, isLoading: query.isPending };
};
