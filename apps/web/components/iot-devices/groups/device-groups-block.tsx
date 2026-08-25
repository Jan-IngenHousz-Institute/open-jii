"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useLocale } from "@/hooks/useLocale";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";
import { GroupOverviewCard } from "./group-overview-card";

/**
 * Groups on the devices overview. Creation is a dashed tile in the grid
 * itself rather than a button floating in the header: the affordance lives
 * where its result will appear, sized like the thing it creates. With no
 * groups yet, the tile alone is the section's whole grid and the hint above
 * explains it.
 */
export function DeviceGroupsBlock() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { data, isLoading, isError, error } = useIotDeviceGroups();
  const [createOpen, setCreateOpen] = useState(false);

  const groups = data ?? [];

  function renderCreateTile() {
    return (
      <button
        type="button"
        onClick={() => {
          setCreateOpen(true);
        }}
        className="text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:ring-primary/40 focus-visible:outline-hidden flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors focus-visible:ring-2"
      >
        <span className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <Plus className="size-5" aria-hidden />
        </span>
        <span className="text-sm font-medium">{t("iot.groups.create")}</span>
      </button>
    );
  }

  function renderBody() {
    if (isError) {
      return <ErrorDisplay error={error} title={t("iot.groups.loadError")} />;
    }
    if (isLoading) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <GroupOverviewCard key={group.id} group={group} locale={locale} />
        ))}
        {renderCreateTile()}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t("iot.devices.sections.groups")}</h2>
        <p className="text-muted-foreground text-sm">{t("iot.groups.sectionHint")}</p>
      </div>

      {renderBody()}

      <CreateDeviceGroupDialog open={createOpen} onOpenChange={setCreateOpen} locale={locale} />
    </section>
  );
}
