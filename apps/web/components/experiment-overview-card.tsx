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

/** One tile of an experiment listing: what it is, how it is doing, when it last moved. */
export function ExperimentOverviewCard({ experiment, href, locale }: ExperimentOverviewCardProps) {
  const { t } = useTranslation("experiments");
  const { t: tMetrics } = useTranslation("publicMetrics");

  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  const unit = tMetrics("resourceMetrics.experiment.unit");
  const activity = experiment.activity ?? null;
  const hasActivity = activity !== null && activity.measurements > 0;

  const renderActivity = (series: ResourceSeries) => (
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
        locale={locale}
      />
    </div>
  );

  // A line rather than nothing: the block is the bottom of every tile in the
  // grid, and dropping it on the quiet ones makes those cards read as broken.
  const renderQuiet = () => (
    <p className="text-muted-foreground border-t pt-3 text-xs">
      {tMetrics("resourceMetrics.quiet", { unit, days: WINDOW_DAYS })}
    </p>
  );

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
      extra={hasActivity ? renderActivity(activity) : renderQuiet()}
      footer={`${t("lastUpdate")}: ${formatShortDate(experiment.updatedAt, locale)}`}
    >
      <RichTextRenderer content={experiment.description ?? " "} truncate maxLines={2} />
    </ResourceCard>
  );
}
