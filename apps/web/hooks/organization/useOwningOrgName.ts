import { useCallback } from "react";

import { authClient } from "@repo/auth/client";

/**
 * Resolves an owning `organizationId` to a display label for list-card badges.
 * Returns null when the id is null/unknown or points at the user's personal
 * org (slug `personal-…`), since that org is an implementation detail.
 */
export function useOwningOrgName(): (organizationId: string | null) => string | null {
  const { data: organizations } = authClient.useListOrganizations();

  return useCallback(
    (organizationId: string | null) => {
      if (!organizationId) return null;
      const org = organizations?.find((o) => o.id === organizationId);
      if (!org || org.slug.startsWith("personal-")) return null;
      return org.name;
    },
    [organizations],
  );
}
