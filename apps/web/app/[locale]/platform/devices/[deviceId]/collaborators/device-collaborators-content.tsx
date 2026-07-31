"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { use } from "react";

interface DeviceCollaboratorsPageProps {
  params: Promise<{ deviceId: string }>;
}

/** Device collaborators route; the layout's detail query supplies cached access. */
export default function DeviceCollaboratorsPage({ params }: DeviceCollaboratorsPageProps) {
  const { deviceId } = use(params);
  const { data } = useIotDevice(deviceId);

  return (
    <ResourceCollaboratorsRoute
      resourceType="device"
      resourceId={deviceId}
      capabilities={data?.capabilities}
    />
  );
}
