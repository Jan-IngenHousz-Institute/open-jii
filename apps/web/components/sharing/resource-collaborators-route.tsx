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
   * Share access earns the list; leave-only access earns the self-leave card.
   * Undefined means unresolved and must not be mistaken for no surface.
   */
  capabilities?: { canShare: boolean; canLeave: boolean };
}

/**
 * A user with neither capability never saw this tab but may visit its URL, so
 * redirect them to the detail route instead of leaving a blank page behind.
 */
export function ResourceCollaboratorsRoute({
  resourceType,
  resourceId,
  capabilities,
}: ResourceCollaboratorsRouteProps) {
  const router = useRouter();
  const locale = useLocale();

  const detailPath = resourceDetailPath(locale, resourceType, resourceId);
  // Wait for capabilities before deciding that no surface exists.
  const hasNoSurface = !!capabilities && !capabilities.canShare && !capabilities.canLeave;

  useEffect(() => {
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
