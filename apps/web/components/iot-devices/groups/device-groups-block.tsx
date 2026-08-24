"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useLocale } from "@/hooks/useLocale";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";
import { GroupOverviewCard } from "./group-overview-card";

/**
 * Groups on the devices overview: a block, not a tab and not a card grid. The
 * ordering is the point. A group is a way of operating on devices, not a peer
 * entity with equal traffic, so it sits beneath the registry on the same list
 * geometry rather than competing with it.
 *
 * No health here: the list payload carries `memberCount` and nothing else, and
 * a rollup would have to be invented. Health lives on each group's monitoring.
 */
export function DeviceGroupsBlock() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { data, isLoading, isError, error } = useIotDeviceGroups();
  const [createOpen, setCreateOpen] = useState(false);

  const groups = data ?? [];

  function renderBody() {
    if (isError) {
      return <ErrorDisplay error={error} title={t("iot.groups.loadError")} />;
    }
    if (isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      );
    }
    if (groups.length === 0) {
      return (
        <EmptyState
          size="inline"
          description={t("iot.groups.emptyHint")}
          action={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              {t("iot.groups.create")}
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <GroupOverviewCard key={group.id} group={group} locale={locale} />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-medium">{t("iot.devices.sections.groups")}</h2>
        <p className="text-muted-foreground text-sm">{t("iot.groups.sectionHint")}</p>
        {groups.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            {t("iot.groups.create")}
          </Button>
        )}
      </div>

      {renderBody()}

      <CreateDeviceGroupDialog open={createOpen} onOpenChange={setCreateOpen} locale={locale} />
    </section>
  );
}
