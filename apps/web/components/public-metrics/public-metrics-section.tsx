"use client";

import type { PublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { useInView } from "@repo/ui/hooks/use-in-view";

import { DailyActivityChart } from "./daily-activity-chart";
import { FamilyBreakdown } from "./family-breakdown";
import { GrowthChart } from "./growth-chart";
import { LivenessChip } from "./liveness-chip";
import { MetricStatTile } from "./metric-stat-tile";

interface PublicMetricsSectionProps {
  metrics: PublicMetricsResponse;
  locale: string;
}

export function PublicMetricsSection({ metrics, locale }: PublicMetricsSectionProps) {
  const { t } = useTranslation("publicMetrics");
  const [sectionRef, inView] = useInView<HTMLElement>({ rootMargin: "-80px" });

  const { totals, registry, dailyActivity, familyTotals } = metrics;

  const tiles = [
    ...(totals ? [{ key: "measurements", value: totals.totalMeasurements }] : []),
    { key: "researchers", value: registry.registeredUsers },
    { key: "experiments", value: registry.experiments },
    ...(totals ? [{ key: "devices", value: totals.devicesAllTime }] : []),
  ];

  const hasGrowthData = dailyActivity.length > 1;
  const hasActivityData = dailyActivity.length > 0;
  const hasFamilyData = familyTotals.length > 0;

  const renderTile = (tile: { key: string; value: number }) => (
    <MetricStatTile
      key={tile.key}
      label={t(`tiles.${tile.key}`)}
      value={tile.value}
      locale={locale}
      active={inView}
    />
  );

  return (
    <section ref={sectionRef} className="w-full max-w-6xl px-4 py-16 md:px-8">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <h2 className="text-foreground text-3xl font-bold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        {totals?.lastMeasurementAt ? (
          <LivenessChip lastMeasurementAt={totals.lastMeasurementAt} locale={locale} />
        ) : null}
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">{tiles.map(renderTile)}</div>

      <div className="grid gap-10 md:grid-cols-2">
        {hasGrowthData ? <GrowthChart data={dailyActivity} locale={locale} /> : null}
        {hasActivityData ? <DailyActivityChart data={dailyActivity} locale={locale} /> : null}
      </div>

      {hasFamilyData ? (
        <div className="mt-10 md:max-w-xl">
          <FamilyBreakdown families={familyTotals} locale={locale} />
        </div>
      ) : null}
    </section>
  );
}
