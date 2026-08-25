"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useLocale } from "@/hooks/useLocale";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";
import { GroupOverviewCard } from "./group-overview-card";

/**
 * Groups on the devices overview. Creation follows the platform's one
 * grammar for it: a primary Plus-button in the section header, the same
 * anatomy as the Devices header above and the organizations listing. A large
 * estate folds behind a toggle; an empty one gets the empty state with the
 * same primary CTA.
 */
/** Four full rows at the 3-column breakpoint, counting the create tile. */
const VISIBLE_GROUPS = 11;

export function DeviceGroupsBlock() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { data, isLoading, isError, error } = useIotDeviceGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const groups = data ?? [];
  // Eleven groups plus the tile fill four rows at the widest breakpoint; a
  // larger estate folds behind the toggle instead of drowning the overview.
  const visibleGroups = showAll ? groups : groups.slice(0, VISIBLE_GROUPS);
  const hiddenCount = groups.length - visibleGroups.length;

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

    if (groups.length === 0) {
      return (
        <EmptyState
          description={t("iot.groups.emptyHint")}
          action={
            <Button
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("iot.groups.create")}
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((group) => (
            <GroupOverviewCard key={group.id} group={group} locale={locale} />
          ))}
        </div>
        {(hiddenCount > 0 || showAll) && groups.length > VISIBLE_GROUPS && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setShowAll((value) => !value);
            }}
          >
            {showAll ? (
              <>
                {t("iot.groups.showFewer")}
                <ChevronUp className="ml-1 size-4" aria-hidden />
              </>
            ) : (
              <>
                {t("iot.groups.showAll", { count: hiddenCount })}
                <ChevronDown className="ml-1 size-4" aria-hidden />
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-medium">{t("iot.devices.sections.groups")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.groups.sectionHint")}</p>
        </div>
        {groups.length > 0 && (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("iot.groups.create")}
          </Button>
        )}
      </div>

      {renderBody()}

      <CreateDeviceGroupDialog open={createOpen} onOpenChange={setCreateOpen} locale={locale} />
    </section>
  );
}
