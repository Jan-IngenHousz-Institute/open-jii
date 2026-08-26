"use client";

import { useLocale } from "@/hooks/useLocale";
import { ChevronRight, Cpu } from "lucide-react";
import Link from "next/link";

import type { IotDeviceGroupListItem } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

/**
 * One group on the devices overview, in the card idiom the organizations,
 * experiments, macros and protocols listings share: the whole card is the
 * link, the description clamps under the title, and the counts ride as pills
 * on the footer line.
 */
export function GroupOverviewCard({ group }: { group: IotDeviceGroupListItem }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  return (
    <Link href={`/${locale}/platform/devices/groups/${group.id}`}>
      <div className="border-border bg-card relative flex h-full min-h-32 flex-col gap-3 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
        <div className="mb-auto">
          <h3 className="text-foreground line-clamp-2 break-words text-base font-semibold">
            {group.name}
          </h3>
          {group.description !== null && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{group.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Cpu className="h-3 w-3" aria-hidden />
            {t("iot.groups.memberCount", { count: group.memberCount })}
          </Badge>
        </div>
        <ChevronRight className="text-foreground absolute bottom-5 right-5 h-6 w-6 md:hidden" />
      </div>
    </Link>
  );
}
