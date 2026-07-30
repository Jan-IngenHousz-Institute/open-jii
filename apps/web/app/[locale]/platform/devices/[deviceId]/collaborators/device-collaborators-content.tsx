"use client";

import { ResourceCollaboratorsRoute } from "@/components/sharing/resource-collaborators-route";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { use } from "react";

interface DeviceCollaboratorsPageProps {
  params: Promise<{ deviceId: string }>;
}

/**
 * Who this device is shared with — the same surface the other resource types have,
 * on the same terms. Sharing is the only way a device reaches anybody outside its
 * owning organization, since it is permanently private.
 *
 * The layout has already loaded the device (and gated on it) before this renders,
 * so the hook resolves from cache and adds no request.
 */
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
