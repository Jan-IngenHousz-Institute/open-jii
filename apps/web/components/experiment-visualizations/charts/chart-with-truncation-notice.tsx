"use client";

import type { ReactNode } from "react";

import { ChartTruncationNotice } from "./chart-truncation-notice";
import type { ChartTruncation } from "./hooks/use-chart-data";

interface ChartWithTruncationNoticeProps {
  truncation?: ChartTruncation;
  children: ReactNode;
}

/** The chart alone for a complete read; the chart with the notice under it otherwise. */
export function ChartWithTruncationNotice({
  truncation,
  children,
}: ChartWithTruncationNoticeProps) {
  if (!truncation) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <ChartTruncationNotice truncation={truncation} />
    </div>
  );
}
