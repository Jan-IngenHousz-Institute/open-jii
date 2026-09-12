"use client";

import { ResourceCard } from "@/components/shared/resource-card";
import { useLocale } from "@/hooks/useLocale";
import { Cpu } from "lucide-react";

import type { IotDeviceGroupListItem } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

/**
 * One group on the devices overview. `ResourceCard` is the shared tile the
 * experiment, protocol, macro and organization listings use; a group carries
 * less than any of them, so it takes a shorter floor than the default 180px.
 */
export function GroupOverviewCard({ group }: { group: IotDeviceGroupListItem }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  return (
    <ResourceCard
      href={`/${locale}/platform/devices/groups/${group.id}`}
      title={group.name}
      className="min-h-32"
      extra={
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Cpu className="h-3 w-3" aria-hidden />
            {t("iot.groups.memberCount", { count: group.memberCount })}
          </Badge>
        </div>
      }
    >
      {group.description === null ? null : (
        <span className="line-clamp-2">{group.description}</span>
      )}
    </ResourceCard>
  );
}
