"use client";

import { DeviceGroupLayoutContent } from "@/components/iot-devices/groups/device-group-layout-content";
import { PlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useIotDeviceGroup } from "@/hooks/iot/useIotDeviceGroup/useIotDeviceGroup";
import { useLocale } from "@/hooks/useLocale";
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
  const locale = useLocale();
  const { t } = useTranslation("iot");
  const { data, isLoading, error } = useIotDeviceGroup(groupId);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data}
      errorDescription={t("iot.groups.loadError")}
    >
      {data && (
        <>
          <PlatformHeaderDetail
            href={`/${locale}/platform/devices/groups/${groupId}`}
            label={data.name}
          />
          <DeviceGroupLayoutContent groupId={groupId} group={data}>
            {children}
          </DeviceGroupLayoutContent>
        </>
      )}
    </EntityLayoutShell>
  );
}
