"use client";

import { useTranslation } from "@repo/i18n";

/**
 * What the server renders in a chart's place. Charts load client-side only,
 * so this holds the slot until the chart chunk arrives, in the same shape as
 * the chart's own loading state.
 */
export function ChartLoading() {
  const { t } = useTranslation("common");

  return (
    <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center text-sm">
      {t("common.loadingChart")}
    </div>
  );
}
