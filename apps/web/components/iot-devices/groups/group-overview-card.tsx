"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { IotDeviceGroupListItem } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface GroupOverviewCardProps {
  group: IotDeviceGroupListItem;
  locale: string;
}

/**
 * One group on the devices overview: a card, not a text row, so a group reads
 * as a place you enter rather than a line you scan. The list payload carries
 * name, description and a member count; everything richer lives on the
 * group's own dashboard behind the click.
 */
export function GroupOverviewCard({ group, locale }: GroupOverviewCardProps) {
  const { t } = useTranslation("iot");

  return (
    <Link
      href={`/${locale}/platform/devices/groups/${group.id}`}
      className="bg-card hover:border-primary/40 hover:shadow-xs focus-visible:ring-primary/40 focus-visible:outline-hidden group flex flex-col gap-3 rounded-xl border p-4 transition focus-visible:ring-2"
    >
      <div className="flex items-start gap-3">
        <div
          className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold uppercase"
          aria-hidden
        >
          {group.name.trim().slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{group.name}</p>
          {group.description !== null && (
            <p className="text-muted-foreground line-clamp-1 text-xs">{group.description}</p>
          )}
        </div>
        <ArrowRight
          className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition"
          aria-hidden
        />
      </div>
      <Badge variant="secondary" className="w-fit">
        {t("iot.groups.memberCount", { count: group.memberCount })}
      </Badge>
    </Link>
  );
}
