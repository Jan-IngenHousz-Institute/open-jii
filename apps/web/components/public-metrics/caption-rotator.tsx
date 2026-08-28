"use client";

import { useEffect, useState } from "react";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

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

/**
 * One rotating almanac line drawing from the caption pool. Values are typed
 * facts; each kind has its own i18n template, so unknown kinds coming from a
 * newer backend are simply skipped.
 */
export function CaptionRotator({ captions, locale }: CaptionRotatorProps) {
  const { t } = useTranslation("publicMetrics");
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);

  const renderCaption = (caption: MetricsCaption): string | null => {
    switch (caption.kind) {
      case "streak":
        return t("captions.streak", { days: format(caption.days) });
      case "pace":
        return t("captions.pace", { seconds: format(caption.secondsPerMeasurement) });
      case "sessionSize":
        return t("captions.sessionSize", { count: format(caption.medianMeasurements) });
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

  useEffect(() => {
    if (held || rendered.length < 2) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % rendered.length),
      ROTATE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [held, rendered.length]);

  if (rendered.length === 0) {
    return null;
  }

  const holdRotation = () => setHeld(true);
  const resumeRotation = () => setHeld(false);

  return (
    <p
      className="text-muted-foreground text-sm italic"
      onMouseEnter={holdRotation}
      onMouseLeave={resumeRotation}
      onFocus={holdRotation}
      onBlur={resumeRotation}
      tabIndex={0}
    >
      {rendered[index % rendered.length]}
    </p>
  );
}
