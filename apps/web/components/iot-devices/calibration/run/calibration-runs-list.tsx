"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useLocale } from "@/hooks/useLocale";
import type { ReactNode } from "react";

import type { CalibrationRun } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationRunStatusBadge } from "./calibration-run-status-badge";

interface CalibrationRunsListProps {
  runs: CalibrationRun[] | undefined;
  /** Procedure names by definition id; a session whose procedure is no longer listed is named unknown. */
  definitionNames: ReadonlyMap<string, string>;
  isLoading: boolean;
  isError: boolean;
  action?: ReactNode;
  onSelectRun: (runId: string) => void;
}

export function CalibrationRunsList({
  runs,
  definitionNames,
  isLoading,
  isError,
  action,
  onSelectRun,
}: CalibrationRunsListProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  function renderRun(run: CalibrationRun) {
    return (
      <li key={run.id}>
        <button
          type="button"
          onClick={() => onSelectRun(run.id)}
          className="hover:bg-muted/40 flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {definitionNames.get(run.definitionId) ?? t("iot.calibration.run.definitionUnknown")}
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                {t("iot.calibration.runs.definition", { version: run.definitionVersion })}
              </span>
            </span>
            {run.errorMessage !== null && (
              <span className="text-destructive block truncate text-xs">{run.errorMessage}</span>
            )}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {new Date(run.createdAt).toLocaleString(locale)}
          </span>
          <CalibrationRunStatusBadge status={run.status} />
        </button>
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
    return <ul className="divide-y overflow-hidden rounded-lg border">{runs.map(renderRun)}</ul>;
  }

  return (
    <PanelCard title={t("iot.calibration.runs.title")} action={action}>
      {renderBody()}
    </PanelCard>
  );
}
