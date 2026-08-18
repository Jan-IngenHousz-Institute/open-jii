"use client";

import { useLocale } from "@/hooks/useLocale";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import type { DeviceGroupDetail } from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";

import { DeviceGroupDetailTabs } from "./device-group-detail-tabs";

interface DeviceGroupLayoutContentProps {
  groupId: string;
  group: DeviceGroupDetail;
  children: React.ReactNode;
}

/** Shared heading and tab strip for all group routes. */
export function DeviceGroupLayoutContent({
  groupId,
  group,
  children,
}: DeviceGroupLayoutContentProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex w-full flex-col gap-6">
        <Link
          href={`/${locale}/platform/devices`}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("iot.groups.backToDevices")}
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-[#011111]">{group.name}</h1>
          {group.description !== null && (
            <p className="text-muted-foreground text-sm">{group.description}</p>
          )}
        </div>
      </div>

      <DeviceGroupDetailTabs
        groupId={groupId}
        canShare={group.capabilities.canShare}
        canLeave={group.capabilities.canLeave}
        canManage={group.capabilities.canManage}
      >
        {children}
      </DeviceGroupDetailTabs>
    </div>
  );
}
