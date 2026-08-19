"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useLocale } from "@/hooks/useLocale";
import { Users } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";
import { GroupCard } from "./group-card";

export function DeviceGroupsView() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { data, isLoading, isError, error } = useIotDeviceGroups();
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
