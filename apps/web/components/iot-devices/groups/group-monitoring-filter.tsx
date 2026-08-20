"use client";

import { Search } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import type { GroupHealthSummary } from "./group-health";
import type { MemberFilter, MemberStatusFilter } from "./group-health";

interface GroupMonitoringFilterProps {
  filter: MemberFilter;
  onFilterChange: (filter: MemberFilter) => void;
  /** Unfiltered counts, so a chip always shows what it would select. */
  summary: GroupHealthSummary;
}

/** Search plus one-of status chips; every panel below follows the selection. */
export function GroupMonitoringFilter({
  filter,
  onFilterChange,
  summary,
}: GroupMonitoringFilterProps) {
  const { t } = useTranslation("iot");

  const chips: { status: MemberStatusFilter; label: string; count: number }[] = [
    { status: "all", label: t("iot.groups.monitoring.filter.all"), count: summary.total },
    { status: "online", label: t("iot.groups.monitoring.onlineLabel"), count: summary.online },
    {
      status: "offline",
      label: t("iot.groups.monitoring.filter.offline"),
      count: summary.total - summary.online - summary.unknown,
    },
    {
      status: "silent",
      label: t("iot.groups.monitoring.filter.silent"),
      count: summary.silent,
    },
    { status: "unknown", label: t("iot.groups.monitoring.unknownLabel"), count: summary.unknown },
  ];

  function renderChip(chip: { status: MemberStatusFilter; label: string; count: number }) {
    const isActive = filter.status === chip.status;

    return (
      <Button
        key={chip.status}
        size="sm"
        variant={isActive ? "default" : "outline"}
        className="h-8"
        onClick={() => {
          onFilterChange({ ...filter, status: chip.status });
        }}
      >
        {chip.label}
        <span className="ml-1.5 tabular-nums opacity-70">{chip.count}</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          aria-label={t("iot.groups.monitoring.filter.searchPlaceholder")}
          value={filter.search}
          onChange={(event) => {
            onFilterChange({ ...filter, search: event.target.value });
          }}
          placeholder={t("iot.groups.monitoring.filter.searchPlaceholder")}
          className="h-8 w-56 pl-8"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">{chips.map(renderChip)}</div>
    </div>
  );
}
