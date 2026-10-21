"use client";

import { useExperimentMeasuredTwice } from "@/hooks/experiment/useExperimentMeasuredTwice/useExperimentMeasuredTwice";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import type { PlotMark } from "../plot-state";
import { FieldDaysGrid } from "./field-days-grid";
import type { FieldPlan } from "./field-plan";
import { LoadFailed } from "./load-failed";
import { MeasuredTwicePanel } from "./measured-twice-panel";

interface MeasuredTwiceSectionProps {
  experimentId: string;
  canEdit: boolean;
  plan: FieldPlan;
}

/** The grid with each plot still measured twice marked, and the panel that settles them. */
export function MeasuredTwiceSection({ experimentId, canEdit, plan }: MeasuredTwiceSectionProps) {
  const { t } = useTranslation("fieldSessions");
  const measurers = useExperimentSessionMeasurers(experimentId);
  const measuredTwice = useExperimentMeasuredTwice(experimentId);

  const retry = () => {
    void measurers.refetch();
    void measuredTwice.refetch();
  };

  if (measurers.isLoading || measuredTwice.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!measurers.data || !measuredTwice.data) {
    return <LoadFailed onRetry={retry} />;
  }

  const open = new Set(
    measuredTwice.data.filter((plot) => plot.resolution === null).map((plot) => plot.unitId),
  );
  const markOf = (unitId: string): PlotMark | undefined =>
    open.has(unitId) ? "measuredTwice" : undefined;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <FieldDaysGrid
        plan={plan}
        description={t("plotCount", { count: plan.plots.length })}
        markOf={markOf}
      />
      <MeasuredTwicePanel
        plan={plan}
        plots={measuredTwice.data}
        measurers={measurers.data}
        canEdit={canEdit}
      />
    </div>
  );
}
