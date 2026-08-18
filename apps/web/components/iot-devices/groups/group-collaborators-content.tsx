"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useIotDeviceGroup } from "@/hooks/iot/useIotDeviceGroup/useIotDeviceGroup";
import { use } from "react";

interface GroupCollaboratorsContentProps {
  params: Promise<{ groupId: string }>;
}

/** Group collaborators route; the layout's detail query supplies cached access. */
export function GroupCollaboratorsContent({ params }: GroupCollaboratorsContentProps) {
  const { groupId } = use(params);
  const { data } = useIotDeviceGroup(groupId);

  return (
    <ResourceCollaboratorsRoute
      resourceType="device_group"
      resourceId={groupId}
      capabilities={data?.capabilities}
    />
  );
}
