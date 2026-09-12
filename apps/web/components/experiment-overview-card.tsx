"use client";

import { ExperimentStatusIndicator } from "@/components/experiment/experiment-status-indicator";
import { ActivitySparkline } from "@/components/metrics/activity-sparkline";
import { ResourceCard } from "@/components/shared/resource-card";
import { VisibilityBadge } from "@/components/visibility/visibility-badge";
import { formatShortDate } from "@/util/date";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

/** The window the list response fills, as the table's activity column also assumes. */
const WINDOW_DAYS = 30;

interface ExperimentOverviewCardProps {
  experiment: ExperimentListItem;
  href: string;
  locale: string;
}

export function ExperimentOverviewCard({ experiment, href, locale }: ExperimentOverviewCardProps) {
  const { t } = useTranslation("experiments");
  const { t: tMetrics } = useTranslation("publicMetrics");

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  const unit = tMetrics("resourceMetrics.experiment.unit");
  const activity = experiment.activity ?? null;

  const renderSeries = (series: ResourceSeries) => (
    <div className="space-y-1 border-t pt-3">
      <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
        <span>{tMetrics("resourceMetrics.experiment.measurements")}</span>
        <span>{tMetrics("window", { days: WINDOW_DAYS })}</span>
      </div>
      <p
        className="text-foreground text-2xl font-semibold tabular-nums"
        title={number.format(series.measurements)}
      >
        {compact.format(series.measurements)}
      </p>
      <ActivitySparkline
        days={series.days}
        seriesName={tMetrics("resourceMetrics.series", { unit })}
        label={tMetrics("resourceMetrics.strip", { days: WINDOW_DAYS, unit })}
        locale={locale}
      />
    </div>
  );

  // A line rather than nothing, so a quiet card does not read as broken.
  const renderQuiet = () => (
    <p className="text-muted-foreground border-t pt-3 text-xs">
      {tMetrics("resourceMetrics.quiet", { unit, days: WINDOW_DAYS })}
    </p>
  );

  // A null series is "none came back", which is also a failed warehouse read,
  // so it cannot be reported as a zero.
  const renderActivity = () => {
    if (activity === null) {
      return null;
    }
    return activity.measurements === 0 ? renderQuiet() : renderSeries(activity);
  };

  return (
    <ResourceCard
      href={href}
      title={experiment.name}
      badges={
        <>
          <ExperimentStatusIndicator
            status={experiment.status}
            className="text-muted-foreground text-xs"
          />
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={experiment.visibility} privateOnly />
        </>
      }
      extra={renderActivity()}
      footer={`${t("lastUpdate")}: ${formatShortDate(experiment.updatedAt, locale)}`}
    >
      <RichTextRenderer content={experiment.description ?? " "} truncate maxLines={2} />
    </ResourceCard>
  );
}
