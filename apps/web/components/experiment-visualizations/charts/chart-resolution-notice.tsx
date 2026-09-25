"use client";

import { formatLocaleNumber } from "@/util/format-locale-number";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { ChartTruncation } from "./hooks/use-chart-data";

/** Whether a line chart is drawn at screen resolution, and the switch between that and every point. */
export interface ChartResolution {
  isReduced: boolean;
  isShowingAll: boolean;
  /** Table rows the drawing stands for. */
  total: number;
  onToggle: () => void;
}

interface ChartResolutionNoticeProps {
  resolution: ChartResolution;
  truncation?: ChartTruncation;
}

export function ChartResolutionNotice({ resolution, truncation }: ChartResolutionNoticeProps) {
  const { t } = useTranslation("experimentVisualizations");
  const locale = useLocale();

  const truncatedMessage = truncation
    ? t("charts.truncated", {
        shown: formatLocaleNumber(truncation.shown, locale),
        total: formatLocaleNumber(truncation.total, locale),
      })
    : undefined;
  const drawingMessage = resolution.isShowingAll
    ? t("charts.showingAllPoints")
    : t("charts.reduced", { total: formatLocaleNumber(resolution.total, locale) });

  // A chart drawing a cut read says so first, whichever way it draws it.
  const message = truncatedMessage ?? drawingMessage;
  const action = resolution.isShowingAll ? t("charts.drawAtResolution") : t("charts.showAllPoints");

  return (
    <p className="text-muted-foreground flex shrink-0 flex-wrap items-baseline gap-x-2 px-3 py-2 text-xs">
      <span>{message}</span>
      <Button variant="link" className="h-auto p-0 text-xs" onClick={resolution.onToggle}>
        {action}
      </Button>
    </p>
  );
}
