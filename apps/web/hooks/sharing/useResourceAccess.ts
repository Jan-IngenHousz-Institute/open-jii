import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

import type { ResourceTypeValue } from "@repo/api/schemas/sharing.schema";

/**
 * The caller's effective permissions on a resource (canRead/canUpdate/canDelete/
 * canShare). Generalizes useExperimentAccess to any resource type.
 */
export const useResourceAccess = (resourceType: ResourceTypeValue, resourceId: string) => {
  return tsr.sharing.getResourceAccess.useQuery({
    queryData: { params: { resourceType, resourceId } },
    queryKey: ["resource-access", resourceType, resourceId],
    retry: shouldRetryQuery,
  });
};
