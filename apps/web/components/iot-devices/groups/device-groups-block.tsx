"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { useState } from "react";

import type { IotDeviceGroupListItem } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";

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

  function renderGroupRow(group: IotDeviceGroupListItem) {
    return (
      <li key={group.id}>
        <Link
          href={`/${locale}/platform/devices/groups/${group.id}`}
          className="hover:bg-muted/30 focus-visible:ring-primary/40 focus-visible:outline-hidden flex items-center gap-3 px-3 py-2.5 focus-visible:ring-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{group.name}</p>
            {group.description !== null && (
              <p className="text-muted-foreground truncate text-xs">{group.description}</p>
            )}
          </div>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {t("iot.groups.memberCount", { count: group.memberCount })}
          </span>
        </Link>
      </li>
    );
  }

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

    return <ul className="divide-y rounded-lg border">{groups.map(renderGroupRow)}</ul>;
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
