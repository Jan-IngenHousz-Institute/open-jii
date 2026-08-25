"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useIotDeviceGroups } from "@/hooks/iot/useIotDeviceGroups/useIotDeviceGroups";
import { useLocale } from "@/hooks/useLocale";
import { ChevronDown, ChevronUp, Plus, Search } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Input } from "@repo/ui/components/input";
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
/** Keeps the unfiltered browse under four rows at the 3-column breakpoint. */
const VISIBLE_GROUPS = 11;

export function DeviceGroupsBlock() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const { data, isLoading, isError, error } = useIotDeviceGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const groups = data ?? [];
  const query = search.trim().toLowerCase();
  const matching =
    query === ""
      ? groups
      : groups.filter(
          (group) =>
            group.name.toLowerCase().includes(query) ||
            (group.description?.toLowerCase().includes(query) ?? false),
        );
  // Search shows every match; the fold only paces the unfiltered browse.
  const isSearching = query !== "";
  const visibleGroups = isSearching || showAll ? matching : matching.slice(0, VISIBLE_GROUPS);
  const hiddenCount = matching.length - visibleGroups.length;

  function renderBody() {
    if (isError) {
      return <ErrorDisplay error={error} title={t("iot.groups.loadError")} />;
    }
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleGroups.map((group) => (
            <GroupOverviewCard key={group.id} group={group} />
          ))}
        </div>
        {isSearching && matching.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("iot.groups.searchNoMatches")}</p>
        )}
        {!isSearching && (hiddenCount > 0 || showAll) && groups.length > VISIBLE_GROUPS && (
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
          <div className="flex items-center gap-2">
            {groups.length > VISIBLE_GROUPS && (
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  placeholder={t("iot.groups.searchPlaceholder")}
                  className="w-56 pl-9"
                />
              </div>
            )}
            <Button
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("iot.groups.create")}
            </Button>
          </div>
        )}
      </div>

      {renderBody()}

      <CreateDeviceGroupDialog open={createOpen} onOpenChange={setCreateOpen} locale={locale} />
    </section>
  );
}
