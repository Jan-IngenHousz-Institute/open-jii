"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { InsetPanel } from "@/components/shared/inset-panel";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import { cn } from "@repo/ui/lib/utils";

import { useDashboardSkippedFiltersForTable } from "../../experiment-dashboards/dashboard-filters-context";
import type { ChartResolution } from "./chart-resolution-notice";
import { ChartWithReadNotice } from "./chart-with-read-notice";
import type { ChartTruncation } from "./hooks/use-chart-data";

interface ChartFrameProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  isLoading: boolean;
  isRefreshing?: boolean;
  error: unknown;
  hasRows: boolean;
  truncation?: ChartTruncation;
  resolution?: ChartResolution;
  children: ReactNode;
}

/** Shared placeholder/state shell for chart renderers. */
export function ChartFrame({
  visualization,
  experimentId,
  isLoading,
  isRefreshing = false,
  error,
  hasRows,
  truncation,
  resolution,
  children,
}: ChartFrameProps) {
  const { t } = useTranslation("experimentVisualizations");
  const skippedFilters = useDashboardSkippedFiltersForTable(visualization.dataConfig.tableName);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("errors.loadingData")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <InsetPanel
        dashed
        padding="lg"
        className="text-muted-foreground flex h-full items-center justify-center"
      >
        <div className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="mb-2 font-medium">{t("errors.failedToLoadData")}</div>
          <div className="text-sm">
            <Trans
              i18nKey="errors.failedToLoadDataDescription"
              ns="experimentVisualizations"
              components={{
                configLink:
                  visualization.id && visualization.id !== "preview" ? (
                    <IntentLink
                      href={`/platform/experiments/${experimentId}/analysis/visualizations/${visualization.id}`}
                      className="text-foreground underline hover:opacity-80"
                    />
                  ) : (
                    <span className="text-foreground" />
                  ),
              }}
            />
          </div>
        </div>
      </InsetPanel>
    );
  }

  if (!hasRows) {
    return (
      <InsetPanel dashed padding="none" className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-2 font-medium">{t("errors.noData")}</div>
          <div className="text-muted-foreground text-sm">{t("errors.noDataFound")}</div>
        </div>
      </InsetPanel>
    );
  }

  // Always rendered, so the chart keeps its place in the tree while a new read refreshes it.
  return (
    <div
      aria-busy={isRefreshing}
      className={cn(
        "flex h-full min-h-0 flex-col transition-opacity",
        isRefreshing && "opacity-50",
      )}
    >
      <ChartWithReadNotice
        truncation={truncation}
        resolution={resolution}
        skippedFilters={skippedFilters}
      >
        {children}
      </ChartWithReadNotice>
    </div>
  );
}

export function ChartConfigError({ message }: { message: string }) {
  const { t } = useTranslation("experimentVisualizations");
  return (
    <InsetPanel
      dashed
      padding="lg"
      className="text-muted-foreground flex h-full items-center justify-center"
    >
      <div className="max-w-md text-center">
        <div className="mb-2 font-medium">{t("errors.configuration")}</div>
        <div className="text-sm">{message}</div>
      </div>
    </InsetPanel>
  );
}
