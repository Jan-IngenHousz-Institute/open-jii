"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetPlotChecks } from "@/hooks/dataset/useDatasetPlotChecks/useDatasetPlotChecks";

import type { MeasuredTwicePlot, SkippedPlot } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import { MeasuredTwiceRow } from "./measured-twice-row";
import { SkippedPlotRow } from "./skipped-plot-row";
import { StepLoadError } from "./step-load-error";

/** What the field days left behind: plots measured twice hold Freeze, skipped plots only inform. */
export function PlotChecksSection({ datasetId }: { datasetId: string }) {
  const { t } = useTranslation("datasets");
  const { data: checks, isLoading, isError, refetch } = useDatasetPlotChecks(datasetId);

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (isError || checks === undefined) {
    return (
      <StepLoadError
        message={t("plotChecks.loadError")}
        retryLabel={t("plotChecks.retry")}
        onRetry={handleRetry}
      />
    );
  }

  const hasMeasuredTwice = checks.measuredTwice.length > 0;
  const hasSkipped = checks.skipped.length > 0;

  if (!hasMeasuredTwice && !hasSkipped) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="plot-checks">
        {t("plotChecks.none")}
      </p>
    );
  }

  const renderMeasuredTwice = (plot: MeasuredTwicePlot) => (
    <MeasuredTwiceRow key={plot.plot} plot={plot} />
  );
  const renderSkipped = (plot: SkippedPlot) => <SkippedPlotRow key={plot.plot} plot={plot} />;

  return (
    <div className="space-y-6" data-testid="plot-checks">
      {hasMeasuredTwice ? (
        <SettingsCard
          title={t("plotChecks.measuredTwiceTitle")}
          description={t("plotChecks.measuredTwiceDescription")}
          data-testid="measured-twice"
        >
          <ul className="divide-border divide-y">
            {checks.measuredTwice.map(renderMeasuredTwice)}
          </ul>
        </SettingsCard>
      ) : null}

      {hasSkipped ? (
        <SettingsCard
          title={t("plotChecks.skippedTitle")}
          description={t("plotChecks.skippedDescription")}
          data-testid="skipped-plots"
        >
          <ul className="divide-border divide-y">{checks.skipped.map(renderSkipped)}</ul>
        </SettingsCard>
      ) : null}
    </div>
  );
}
