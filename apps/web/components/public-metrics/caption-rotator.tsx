"use client";

import { useState } from "react";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { useRotation } from "@repo/ui/hooks/use-rotation";

const ROTATE_INTERVAL_MS = 5000;

interface CaptionRotatorProps {
  captions: MetricsCaption[];
  locale: string;
}

function formatBytes(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

/** One rotating line from the caption pool. Each kind has its own i18n template. */
export function CaptionRotator({ captions, locale }: CaptionRotatorProps) {
  const { t } = useTranslation("publicMetrics");
  const [index, setIndex] = useState(0);

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);

  const renderCaption = (caption: MetricsCaption): string | null => {
    switch (caption.kind) {
      case "streak":
        return t("captions.streak", { days: format(caption.days) });
      case "pace":
        // Below one second per measurement the interval reads as "every 0
        // seconds", so the same fact is stated as a rate instead.
        if (caption.secondsPerMeasurement <= 0) {
          return null;
        }
        return caption.secondsPerMeasurement >= 1
          ? t("captions.pace", { count: Math.round(caption.secondsPerMeasurement) })
          : t("captions.paceFast", {
              count: Math.max(1, Math.round(1 / caption.secondsPerMeasurement)),
            });
      case "sessionSize":
        return t("captions.sessionSize", { count: caption.medianMeasurements });
      case "endurance":
        return t("captions.endurance", { days: format(caption.days) });
      case "simultaneity":
        return t("captions.simultaneity", { devices: format(caption.devices) });
      case "zonesPeakDay":
        return t("captions.zonesPeakDay", { zones: format(caption.zones) });
      case "analysesRun":
        return t("captions.analysesRun", { count: format(caption.count) });
      case "avgMeasurementSize":
        return t("captions.avgMeasurementSize", { size: formatBytes(caption.bytes, locale) });
      case "openDatasets":
        return t("captions.openDatasets", { count: format(caption.count) });
      case "sharedExperiments":
        return t("captions.sharedExperiments", { count: format(caption.count) });
      case "milestone":
        return t("captions.milestone", {
          ordinal: format(caption.ordinal),
          date: new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeZone: "UTC",
          }).format(new Date(caption.date)),
        });
      // A newer backend may ship kinds this bundle has no template for.
      default:
        return null;
    }
  };

  const rendered = captions.map(renderCaption).filter((text): text is string => text !== null);

  const showNext = () => setIndex((current) => (current + 1) % rendered.length);
  const rotation = useRotation({
    intervalMs: ROTATE_INTERVAL_MS,
    onAdvance: showNext,
    position: index,
    canRotate: rendered.length > 1,
  });

  if (rendered.length === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm italic" tabIndex={0} {...rotation.holdHandlers}>
      {rendered[index % rendered.length]}
    </p>
  );
}
