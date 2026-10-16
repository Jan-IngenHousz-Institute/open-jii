"use client";

import { displayableChange } from "@/components/metrics/metric-stat-card";
import { TrendSparkline } from "@/components/metrics/trend-sparkline";
import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";
import { formatLocaleNumber } from "@/util/format-locale-number";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { DashboardSection } from "./dashboard-section";

interface ActivitySectionProps {
  locale: string;
}

/** The reader's own 30 days, with the community beside it rather than as the headline. */
export function ActivitySection({ locale }: ActivitySectionProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: mine, isPending } = useMyScopedMetrics();
  const { data: platform } = usePublicMetrics();

  if (isPending) {
    return <Skeleton aria-busy="true" className="h-48" />;
  }

  const scoped = mine?.scoped ?? null;

  // Nothing rather than a row of zeros, as on the list pages.
  if (scoped === null || scoped.measurements30d === 0) {
    return null;
  }

  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const windowDays = scoped.activity.length;
  const community = platform?.community ?? null;

  const change = displayableChange({
    current: scoped.measurements30d,
    previous: scoped.previousMeasurements,
  });
  const isRising = change !== null && change > 0;
  const changeLabel =
    change === null
      ? null
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 0,
          signDisplay: "exceptZero",
        }).format(change);

  const figure = <b className="text-foreground font-semibold tabular-nums" />;

  return (
    <DashboardSection id="last-30-days" title={t("dashboard.activity.title")}>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          {t("dashboard.activity.label")}
        </span>
        <span
          className="flex items-baseline gap-2"
          title={formatLocaleNumber(scoped.measurements30d, locale)}
        >
          <span className="text-2xl font-bold tabular-nums tracking-tight">
            {compact.format(scoped.measurements30d)}
          </span>
          {changeLabel === null ? null : (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                isRising
                  ? "bg-status-active text-status-active-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {changeLabel}
            </span>
          )}
        </span>
        <span className="text-muted-foreground text-xs">
          {t("previousWindow", {
            value: compact.format(scoped.previousMeasurements),
            days: windowDays,
          })}
        </span>
      </div>

      <TrendSparkline
        days={scoped.activity}
        mark="line"
        peakDate={scoped.peak?.date ?? null}
        seriesName={t("dashboard.activity.trend")}
        locale={locale}
        className="h-11 w-full"
      />

      <ul className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-1.5 border-t pt-2 text-xs">
        <li>
          <Trans
            t={t}
            i18nKey="dashboard.activity.activeExperiments"
            count={scoped.activeExperiments30d}
            components={{ b: figure }}
          />
        </li>
        <li>
          <Trans
            t={t}
            i18nKey="dashboard.activity.contributors"
            count={scoped.contributors30d}
            components={{ b: figure }}
          />
        </li>
        {scoped.devices30d === null ? null : (
          <li>
            <Trans
              t={t}
              i18nKey="dashboard.activity.devices"
              count={scoped.devices30d}
              components={{ b: figure }}
            />
          </li>
        )}
        {community === null ? null : (
          <li title={formatLocaleNumber(community.measurements30d, locale)}>
            <Trans
              t={t}
              i18nKey="dashboard.activity.community"
              values={{ value: compact.format(community.measurements30d) }}
              components={{ b: figure }}
            />
          </li>
        )}
      </ul>
    </DashboardSection>
  );
}
