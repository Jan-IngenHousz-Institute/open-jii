"use client";

import type { ReactNode } from "react";

import type { SkippedDashboardFilter } from "../../experiment-dashboards/dashboard-filters-context";
import { SkippedFiltersNotice } from "../../experiment-dashboards/widgets/shell/skipped-filters-notice";
import { ChartResolutionNotice } from "./chart-resolution-notice";
import type { ChartResolution } from "./chart-resolution-notice";
import { ChartTruncationNotice } from "./chart-truncation-notice";
import type { ChartTruncation } from "./hooks/use-chart-data";

interface ChartWithReadNoticeProps {
  truncation?: ChartTruncation;
  resolution?: ChartResolution;
  skippedFilters?: SkippedDashboardFilter[];
  children: ReactNode;
}

/**
 * The chart alone when it draws every row it read with every dashboard filter applied; otherwise the
 * chart with a line under it for each thing it leaves out.
 */
export function ChartWithReadNotice({
  truncation,
  resolution,
  skippedFilters = [],
  children,
}: ChartWithReadNoticeProps) {
  const shownResolution =
    resolution?.isReduced || resolution?.isShowingAll ? resolution : undefined;
  if (!shownResolution && !truncation && skippedFilters.length === 0) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      {skippedFilters.length > 0 && <SkippedFiltersNotice skippedFilters={skippedFilters} />}
      {shownResolution ? (
        <ChartResolutionNotice resolution={shownResolution} truncation={truncation} />
      ) : (
        truncation && <ChartTruncationNotice truncation={truncation} />
      )}
    </div>
  );
}
