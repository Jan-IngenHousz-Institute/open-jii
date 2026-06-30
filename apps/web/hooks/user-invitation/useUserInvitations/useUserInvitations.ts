import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { InvitationResourceType } from "@repo/api/domains/user/user.schema";

/**
 * Hook to fetch pending invitations for a resource.
 * @param resourceType The type of resource (e.g. "experiment")
 * @param resourceId The ID of the resource
 */
export const useUserInvitations = (resourceType: InvitationResourceType, resourceId: string) => {
  return useQuery(
    orpc.users.listInvitations.queryOptions({
      input: {
        resourceType,
        resourceId,
      },
    }),
  );
};
