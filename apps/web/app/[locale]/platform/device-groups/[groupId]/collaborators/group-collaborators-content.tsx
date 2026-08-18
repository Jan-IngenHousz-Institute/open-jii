"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useDeviceGroup } from "@/hooks/device-groups/use-device-groups";
import { use } from "react";

interface GroupCollaboratorsContentProps {
  params: Promise<{ groupId: string }>;
}

/** Group collaborators route; the layout's detail query supplies cached access. */
export default function GroupCollaboratorsContent({ params }: GroupCollaboratorsContentProps) {
  const { groupId } = use(params);
  const { data } = useDeviceGroup(groupId);

  return (
    <ResourceCollaboratorsRoute
      resourceType="device_group"
      resourceId={groupId}
      capabilities={data?.capabilities}
    />
  );
}
