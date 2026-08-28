"use client";

import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";
import { useState } from "react";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

const isMilestone = (
  caption: MetricsCaption,
): caption is Extract<MetricsCaption, { kind: "milestone" }> => caption.kind === "milestone";

interface MilestoneBannerProps {
  locale: string;
}

/** An announcement moment, not a widget: shown only while a milestone stands. */
export function MilestoneBanner({ locale }: MilestoneBannerProps) {
  const { t } = useTranslation("publicMetrics");
  const { data } = usePublicMetrics();
  const [dismissed, setDismissed] = useState(false);

  const milestone = data?.captions.find(isMilestone);
  if (dismissed || milestone === undefined) {
    return null;
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(milestone.date));

  const dismiss = () => setDismissed(true);

  return (
    <div className="border-status-active-foreground/30 bg-status-active text-status-active-foreground flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm">
      <span>
        {t("dashboard.milestone", {
          ordinal: new Intl.NumberFormat(locale).format(milestone.ordinal),
          date: formattedDate,
        })}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dashboard.dismiss")}
        className="text-muted-foreground hover:text-foreground text-base leading-none"
      >
        &times;
      </button>
    </div>
  );
}
