import { orpc, orpcClient } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { VisitedResourceType } from "@repo/api/domains/visit/visit.schema";

/**
 * Records that the caller opened a resource, once per id while `enabled`. Called on
 * the client rather than through `useMutation`, whose global error toast would show
 * on a page where recording the visit is meant to be invisible.
 */
export function useRecordVisit(
  resourceType: VisitedResourceType,
  resourceId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    orpcClient.visits
      .recordVisit({ resourceType, resourceId })
      .then(() => queryClient.invalidateQueries({ queryKey: orpc.visits.listRecentlyOpened.key() }))
      .catch(() => undefined);
  }, [enabled, resourceType, resourceId, queryClient]);
}
