import { tsr } from "@/lib/tsr";

import type { InvitationResourceType } from "@repo/api";

/**
 * Hook to fetch pending invitations for a resource.
 * @param resourceType The type of resource (e.g. "experiment")
 * @param resourceId The ID of the resource
 */
export const useUserInvitations = (resourceType: InvitationResourceType, resourceId: string) => {
  return tsr.users.listInvitations.useQuery({
    queryData: {
      query: {
        resourceType,
        resourceId,
      },
    },
    queryKey: ["experiment-invitations", resourceType, resourceId],
  });
};
