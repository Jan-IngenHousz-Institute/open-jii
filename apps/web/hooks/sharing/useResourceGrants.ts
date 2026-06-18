import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

import type { ResourceTypeValue } from "@repo/api/schemas/sharing.schema";

/** Grants (shares) on a resource. Requires read access to the resource. */
export const useResourceGrants = (resourceType: ResourceTypeValue, resourceId: string) => {
  return tsr.sharing.listResourceGrants.useQuery({
    queryData: { params: { resourceType, resourceId } },
    queryKey: ["resource-grants", resourceType, resourceId],
    retry: shouldRetryQuery,
  });
};
