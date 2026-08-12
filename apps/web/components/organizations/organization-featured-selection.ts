import type { OrganizationResource } from "@repo/api/domains/organization/organization.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { GROUP_ORDER } from "./organization-resource-meta";

/** How many resources the featured card shows. Two rows of the two-column grid. */
export const FEATURED_LIMIT = 6;

/**
 * The organization's most-worked-on resources, spread across types. Ranked by
 * collaborator count with `updatedAt` as the tiebreak, but *within* each type and then
 * filled by rotating through {@link GROUP_ORDER} — experiments attract collaborators in
 * a way the other types do not, so a flat ranking returns six experiments and the card
 * becomes a copy of the Experiments group below it. A type that runs out gives its
 * slots to the others.
 *
 * Derived, not stored: there is no `featured` column. Drawn only from rows the caller
 * was already given, so it is access-scoped by construction.
 */
export function pickFeaturedResources(
  resources: readonly OrganizationResource[],
  limit = FEATURED_LIMIT,
): OrganizationResource[] {
  const byType = new Map<SharingResourceType, OrganizationResource[]>(
    GROUP_ORDER.map((type) => [
      type,
      resources
        .filter((resource) => resource.type === type)
        .sort(
          (a, b) =>
            b.collaboratorCount - a.collaboratorCount ||
            Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
    ]),
  );

  const featured: OrganizationResource[] = [];
  // Rotate until a whole pass adds nothing, which is the only honest stop condition:
  // "queues drained" and "limit reached" can both happen first.
  let added = true;
  while (featured.length < limit && added) {
    added = false;
    for (const type of GROUP_ORDER) {
      if (featured.length >= limit) break;
      const next = byType.get(type)?.shift();
      if (!next) continue;
      featured.push(next);
      added = true;
    }
  }

  return featured;
}
