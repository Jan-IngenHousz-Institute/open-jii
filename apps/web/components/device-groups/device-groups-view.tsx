"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useDeviceGroups } from "@/hooks/device-groups/use-device-groups";
import { useLocale } from "@/hooks/useLocale";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { DeviceGroupListItem } from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";

export function DeviceGroupsView() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { data, isLoading, isError, error } = useDeviceGroups();
  const [createOpen, setCreateOpen] = useState(false);

  if (isError) {
    return <ErrorDisplay error={error} title={t("iot.groups.loadError")} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t("iot.groups.sectionHint")}</p>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          {t("iot.groups.create")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="text-muted-foreground h-8 w-8" aria-hidden />
            <p className="font-medium">{t("iot.groups.emptyTitle")}</p>
            <p className="text-muted-foreground text-sm">{t("iot.groups.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((group) => (
            <GroupCard key={group.id} group={group} locale={locale} />
          ))}
        </div>
      )}

      <CreateDeviceGroupDialog open={createOpen} onOpenChange={setCreateOpen} locale={locale} />
    </div>
  );
}

function GroupCard({ group, locale }: { group: DeviceGroupListItem; locale: string }) {
  const { t } = useTranslation("iot");

  return (
    <Link href={`/${locale}/platform/device-groups/${group.id}`} className="block">
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
