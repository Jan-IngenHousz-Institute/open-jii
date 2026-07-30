"use client";

import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { LeaveResourceCard } from "./leave-resource-card";
import { ResourceCollaborators } from "./resource-collaborators";
import { resourceDetailPath } from "./resource-routes";

interface ResourceCollaboratorsRouteProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /**
   * `capabilities` from the detail response — `undefined` while it is still
   * unknown. `canShare` earns the full surface; `canLeave` without it earns only
   * the leave card, because a grantee below `share` cannot see the list and so
   * has no row of their own to give up their access from.
   */
  capabilities?: { canShare: boolean; canLeave: boolean };
}

/**
 * The body of a macro's, protocol's or workbook's Collaborators route — the same
 * three outcomes on all of them, so the routes themselves stay thin wrappers
 * that only know which detail hook to read.
 *
 * Someone with neither capability has no sharing surface at all, and never saw
 * the tab that leads here. They can still type the URL, so send them back to the
 * resource rather than leaving them on a blank route.
 */
export function ResourceCollaboratorsRoute({
  resourceType,
  resourceId,
  capabilities,
}: ResourceCollaboratorsRouteProps) {
  const router = useRouter();
  const locale = useLocale();

  const detailPath = resourceDetailPath(locale, resourceType, resourceId);
  // Only once the capabilities are actually in hand: "not yet known" must not
  // read as "nothing to show here".
  const hasNoSurface = !!capabilities && !capabilities.canShare && !capabilities.canLeave;

  useEffect(() => {
    // `replace`, not `push`: this route is not somewhere to come back to.
    if (hasNoSurface) router.replace(detailPath);
  }, [hasNoSurface, detailPath, router]);

  if (!capabilities || hasNoSurface) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      {capabilities.canShare ? (
        <ResourceCollaborators resourceType={resourceType} resourceId={resourceId} canShare />
      ) : (
        <LeaveResourceCard resourceType={resourceType} resourceId={resourceId} />
      )}
    </div>
  );
}
