"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useLocale } from "@/hooks/useLocale";

import type { CalibrationRun } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationRunStatusBadge } from "./calibration-run-status-badge";

interface CalibrationRunsListProps {
  runs: CalibrationRun[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Every bench session recorded for the device, newest first. */
export function CalibrationRunsList({ runs, isLoading, isError }: CalibrationRunsListProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  function renderRun(run: CalibrationRun) {
    return (
      <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <div className="min-w-0">
          <p className="text-sm">
            {new Date(run.createdAt).toLocaleString(locale)}
            <span className="text-muted-foreground ml-2 text-xs">
              {t("iot.calibration.runs.definition", { version: run.definitionVersion })}
            </span>
          </p>
          {run.errorMessage !== null && (
            <p className="text-destructive truncate text-xs">{run.errorMessage}</p>
          )}
        </div>
        <CalibrationRunStatusBadge status={run.status} />
      </li>
    );
  }

  function renderBody() {
    if (isLoading) {
      return <Skeleton className="h-24 w-full" />;
    }
    if (isError) {
      return (
        <EmptyState size="inline" variant="error" description={t("iot.calibration.loadError")} />
      );
    }
    if (!runs || runs.length === 0) {
      return <EmptyState size="inline" description={t("iot.calibration.runs.empty")} />;
    }
    return <ul className="divide-y">{runs.map(renderRun)}</ul>;
  }

  return <PanelCard title={t("iot.calibration.runs.title")}>{renderBody()}</PanelCard>;
}
