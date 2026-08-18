"use client";

import { DeviceGroupLayoutContent } from "@/components/device-groups/device-group-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useDeviceGroup } from "@/hooks/device-groups/use-device-groups";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface DeviceGroupLayoutProps {
  children: React.ReactNode;
}

/**
 * Loads the group once for every tab under it, and owns the header + strip.
 * Each tab route resolves the same query from cache and adds no request.
 */
export default function DeviceGroupLayout({ children }: DeviceGroupLayoutProps) {
  const { groupId } = useParams<{ groupId: string }>();
  const { t } = useTranslation("iot");
  const { data, isLoading, error } = useDeviceGroup(groupId);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data}
      errorDescription={t("iot.groups.loadError")}
    >
      {data && (
        <DeviceGroupLayoutContent groupId={groupId} group={data}>
          {children}
        </DeviceGroupLayoutContent>
      )}
    </EntityLayoutShell>
  );
}
