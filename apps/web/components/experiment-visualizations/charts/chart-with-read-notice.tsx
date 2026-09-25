"use client";

import type { ReactNode } from "react";

import { ChartResolutionNotice } from "./chart-resolution-notice";
import type { ChartResolution } from "./chart-resolution-notice";
import { ChartTruncationNotice } from "./chart-truncation-notice";
import type { ChartTruncation } from "./hooks/use-chart-data";

interface ChartWithReadNoticeProps {
  truncation?: ChartTruncation;
  resolution?: ChartResolution;
  children: ReactNode;
}

/**
 * The chart alone when it draws every row it read; otherwise the chart with a line under it saying
 * how much it shows.
 */
export function ChartWithReadNotice({
  truncation,
  resolution,
  children,
}: ChartWithReadNoticeProps) {
  const shownResolution =
    resolution?.isReduced || resolution?.isShowingAll ? resolution : undefined;
  if (!shownResolution && !truncation) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      {shownResolution ? (
        <ChartResolutionNotice resolution={shownResolution} truncation={truncation} />
      ) : (
        truncation && <ChartTruncationNotice truncation={truncation} />
      )}
    </div>
  );
}
