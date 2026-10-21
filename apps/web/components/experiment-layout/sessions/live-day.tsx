"use client";

import { useExperimentSessionAssignments } from "@/hooks/experiment/useExperimentSessionAssignments/useExperimentSessionAssignments";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";
import { useExperimentSessionProgress } from "@/hooks/experiment/useExperimentSessionProgress/useExperimentSessionProgress";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";

import { FieldDaysEmptyState } from "../field-days-empty-state";
import type { PlotMark } from "../plot-state";
import { FieldDaysGrid } from "./field-days-grid";
import type { FieldPlan } from "./field-plan";
import { FieldShares } from "./field-shares";
import { LiveProgressCard } from "./live-progress-card";
import { LoadFailed } from "./load-failed";

interface LiveDayProps {
  experimentId: string;
  plan: FieldPlan;
}

/** Today while sessions run: the grid filling in, and each measurer's progress beside it. */
export function LiveDay({ experimentId, plan }: LiveDayProps) {
  const { t } = useTranslation("fieldSessions");
  const measurers = useExperimentSessionMeasurers(experimentId);
  const assignments = useExperimentSessionAssignments(experimentId);
  const progress = useExperimentSessionProgress(experimentId);

  const retry = () => {
    void measurers.refetch();
    void assignments.refetch();
    void progress.refetch();
  };

  if (measurers.isLoading || assignments.isLoading || progress.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!measurers.data || assignments.isError || progress.isError) {
    return <LoadFailed onRetry={retry} />;
  }

  if (!progress.data) {
    return <FieldDaysEmptyState />;
  }

  const shares = new FieldShares(assignments.data?.shares ?? [], measurers.data);
  const measured = new Set(progress.data.measurers.flatMap((entry) => entry.measuredUnitIds));
  const skipped = new Set(progress.data.measurers.flatMap((entry) => entry.skippedUnitIds));

  const markOf = (unitId: string): PlotMark | undefined => {
    if (measured.has(unitId)) {
      return "measured";
    }
    return skipped.has(unitId) ? "skipped" : undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">{t("fieldDays.today")}</h3>
        <Badge className="bg-status-active text-status-active-foreground">
          {t("fieldDays.running")}
        </Badge>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <FieldDaysGrid
          plan={plan}
          description={t("live.gridDescription", {
            measured: measured.size,
            total: plan.plots.length,
          })}
          markOf={markOf}
          shares={shares}
        />
        <LiveProgressCard plan={plan} shares={shares} progress={progress.data} />
      </div>
    </div>
  );
}
