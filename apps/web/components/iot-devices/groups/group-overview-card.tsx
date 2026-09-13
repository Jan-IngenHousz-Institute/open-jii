"use client";

import { ResourceCard } from "@/components/shared/resource-card";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { useLocale } from "@/hooks/useLocale";
import { formatShortDate } from "@/util/date";
import { Cpu } from "lucide-react";

import type { IotDeviceGroupListItem } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";

/** True for any card in the set, so the reserved badge row is never dead space. */
export function hasGroupBadges(group: IotDeviceGroupListItem): boolean {
  return group.visibility === "private";
}

interface GroupOverviewCardProps {
  group: IotDeviceGroupListItem;
  reserveBadgeRow: boolean;
}

/** One group on the devices overview, reading like the other resource tiles. */
export function GroupOverviewCard({ group, reserveBadgeRow }: GroupOverviewCardProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const renderFooter = () => (
    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <Cpu className="size-3.5 shrink-0" aria-hidden />
        {t("iot.groups.memberCount", { count: group.memberCount })}
      </span>
      <span className="tabular-nums">{formatShortDate(group.updatedAt, locale)}</span>
    </span>
  );

  return (
    <ResourceCard
      href={`/${locale}/platform/devices/groups/${group.id}`}
      title={group.name}
      className="min-h-40"
      badges={
        reserveBadgeRow ? <VisibilityBadge visibility={group.visibility} privateOnly /> : undefined
      }
      footer={renderFooter()}
    >
      {group.description === null ? null : (
        <span className="line-clamp-2">{group.description}</span>
      )}
    </ResourceCard>
  );
}
