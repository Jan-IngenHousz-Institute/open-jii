"use client";

import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";
import { useEffect, useState } from "react";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

const isMilestone = (
  caption: MetricsCaption,
): caption is Extract<MetricsCaption, { kind: "milestone" }> => caption.kind === "milestone";

// A milestone stands for months, so dismissal outlives the mount. Keyed by the
// milestone itself: the next one is news again.
const DISMISSED_KEY = "openjii.milestone.dismissed";

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

interface MilestoneBannerProps {
  locale: string;
}

/** Shown only while a milestone stands and the reader has not dismissed it. */
export function MilestoneBanner({ locale }: MilestoneBannerProps) {
  const { t } = useTranslation("publicMetrics");
  const { data } = usePublicMetrics();
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Read after mount: server and client would otherwise disagree on the markup.
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const milestone = data?.captions.find(isMilestone);
  if (milestone === undefined || dismissed === String(milestone.ordinal)) {
    return null;
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(milestone.date));

  const dismiss = () => {
    const ordinal = String(milestone.ordinal);
    setDismissed(ordinal);
    try {
      window.localStorage.setItem(DISMISSED_KEY, ordinal);
    } catch {
      // A browser refusing storage still gets the banner closed for this visit.
    }
  };

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
