"use client";

import Link from "next/link";

import type { IotDeviceGroupListItem } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";

interface GroupCardProps {
  group: IotDeviceGroupListItem;
  locale: string;
}

export function GroupCard({ group, locale }: GroupCardProps) {
  const { t } = useTranslation("iot");

  return (
    <Link href={`/${locale}/platform/devices/groups/${group.id}`} className="block">
      <Card className="hover:border-primary/40 h-full shadow-none transition-colors">
        <CardContent className="space-y-1 p-4">
          <p className="font-medium">{group.name}</p>
          {group.description !== null && (
            <p className="text-muted-foreground line-clamp-2 text-sm">{group.description}</p>
          )}
          <p className="text-muted-foreground text-xs tabular-nums">
            {t("iot.groups.memberCount", { count: group.memberCount })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
