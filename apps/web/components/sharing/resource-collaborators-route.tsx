"use client";

import { ResourceAccessDenied } from "@/components/shared/resource-access-denied";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { LeaveResourceCard } from "./leave-resource-card";
import { ResourceCollaborators } from "./resource-collaborators";

interface ResourceCollaboratorsRouteProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /**
   * Share access earns the list; leave-only access earns the self-leave card.
   * Undefined means unresolved and must not be mistaken for no surface.
   */
  capabilities?: { canShare: boolean; canLeave: boolean };
}

export function ResourceCollaboratorsRoute({
  resourceType,
  resourceId,
  capabilities,
}: ResourceCollaboratorsRouteProps) {
  // Wait for capabilities before deciding that no surface exists.
  if (!capabilities) {
    return null;
  }

  if (!capabilities.canShare && !capabilities.canLeave) {
    return <ResourceAccessDenied resource={resourceType} />;
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
