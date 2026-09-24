"use client";

import { useExperimentDataFreshness } from "@/hooks/experiment/useExperimentDataFreshness/useExperimentDataFreshness";
import type { DataFreshnessStatus } from "@/hooks/experiment/useExperimentDataFreshness/useExperimentDataFreshness";
import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { Loader2, Pause, Play } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

const DOT_CLASS: Record<DataFreshnessStatus, string> = {
  live: "bg-status-active-foreground animate-pulse",
  paused: "bg-border",
  behind: "bg-status-stale-foreground",
};

interface DataFreshnessProps {
  experimentId: string;
  /** Whose newest row to report; omitted, the newest in the experiment. */
  tableName?: string;
}

/** Keeps the experiment's rows and charts current, and says how current they are. */
export function DataFreshness({ experimentId, tableName }: DataFreshnessProps) {
  const { t } = useTranslation("experiments");
  const locale = useLocale();
  const {
    hasLoaded,
    status,
    newestRowAt,
    refreshedAt,
    isChecking,
    isLoadingRows,
    isPaused,
    togglePaused,
  } = useExperimentDataFreshness(experimentId, tableName);

  if (!hasLoaded) {
    return null;
  }

  const liveLabel =
    status === "behind"
      ? t("experimentData.freshness.behind", { time: formatRelativeTime(refreshedAt, locale) })
      : t(`experimentData.freshness.${status}`);
  const statusLabel = isLoadingRows ? t("experimentData.freshness.updating") : liveLabel;
  const isBusy = isChecking || isLoadingRows;
  const statusIcon = isBusy ? (
    <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
  ) : (
    <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[status])} />
  );
  const newestLabel =
    newestRowAt === null
      ? t("experimentData.freshness.noRows")
      : t("experimentData.freshness.newestRow", { time: formatRelativeTime(newestRowAt, locale) });
  const toggleLabel = t(
    isPaused ? "experimentData.freshness.resume" : "experimentData.freshness.pause",
  );
  const ToggleIcon = isPaused ? Play : Pause;

  return (
    <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      {statusIcon}
      <span>{statusLabel}</span>
      <span aria-hidden="true">·</span>
      <span>{newestLabel}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6"
        onClick={togglePaused}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        <ToggleIcon className="size-3.5" />
      </Button>
    </div>
  );
}
