"use client";

import { ORGANIZATION_AUTH_QUERY_KEY } from "@/hooks/organization/organization-cache";
import { withPrincipal } from "@/hooks/principal-query-key";
import { useQuery } from "@tanstack/react-query";

import { authClient, useSession } from "@repo/auth/client";

/**
 * Whether a slug is still free. Better Auth answers this by *refusing* the
 * request when the slug is taken, so a rejection is the negative answer rather
 * than a failure — hence the boolean rather than a thrown error, and no retry.
 *
 * It checks uniqueness only: format and the reserved `personal-` namespace are
 * validated separately, client-side and in the plugin's own hooks. Callers must
 * pass an already well-formed slug, or a malformed one would read as "available".
 */
export const useOrganizationSlugAvailability = (slug: string, options?: { enabled?: boolean }) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: withPrincipal([...ORGANIZATION_AUTH_QUERY_KEY, "slug", slug], userId),
    queryFn: async () => {
      const { error } = await authClient.organization.checkSlug({ slug });
      return error === null;
    },
    retry: false,
    enabled: (options?.enabled ?? true) && slug.length > 0 && !isSessionPending,
  });
};
