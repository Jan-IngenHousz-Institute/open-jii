"use client";

import { displayableChange } from "@/components/metrics/metric-stat-card";
import { TrendSparkline } from "@/components/metrics/trend-sparkline";
import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";
import { useCarouselRotation } from "@/hooks/useCarouselRotation";
import { formatLocaleNumber } from "@/util/format-locale-number";
import { useState } from "react";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import { Carousel, CarouselContent, CarouselItem } from "@repo/ui/components/carousel";
import type { CarouselApi } from "@repo/ui/components/carousel";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { ActivityCarouselControls } from "./activity-carousel-controls";
import { ActivitySlide } from "./activity-slide";
import { DashboardSection } from "./dashboard-section";

/** Each slide carries a figure, a few notes and often a chart, more than a one-line caption. */
const ROTATE_INTERVAL_MS = 6000;

interface ActivitySectionProps {
  locale: string;
}

interface Slide {
  key: string;
  label: string;
  content: ReactNode;
}

/** The reader's own 30 days a figure at a time, with the community's as the last one. */
export function ActivitySection({ locale }: ActivitySectionProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: mine, isPending } = useMyScopedMetrics();
  const { data: platform } = usePublicMetrics();
  const [api, setApi] = useState<CarouselApi>();
  const rotation = useCarouselRotation(api, ROTATE_INTERVAL_MS);

  if (isPending) {
    return <Skeleton aria-busy="true" className="h-48" />;
  }

  const scoped = mine?.scoped ?? null;

  // Nothing rather than a row of zeros, as on the list pages.
  if (scoped === null || scoped.measurements30d === 0) {
    return null;
  }

  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  // Warehouse days are UTC.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const windowDays = scoped.activity.length;
  const community = platform?.community ?? null;
  const peak = scoped.peak;
  const dailyAverage = Math.round(scoped.measurements30d / windowDays);

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
  const countLine = (key: string, count: number) => (
    <span key={key}>
      <Trans t={t} i18nKey={`dashboard.activity.${key}`} count={count} components={{ b: figure }} />
    </span>
  );

  const changeBadge =
    changeLabel === null ? null : (
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
    );

  const slides: Slide[] = [
    {
      key: "measurements",
      label: t("dashboard.activity.label"),
      content: (
        <ActivitySlide
          label={t("dashboard.activity.label")}
          value={compact.format(scoped.measurements30d)}
          title={formatLocaleNumber(scoped.measurements30d, locale)}
          badge={changeBadge}
          notes={t("previousWindow", {
            value: compact.format(scoped.previousMeasurements),
            days: windowDays,
          })}
          chart={
            <TrendSparkline
              days={scoped.activity}
              mark="line"
              peakDate={null}
              seriesName={t("dashboard.activity.trend")}
              locale={locale}
              className="h-11 w-full"
            />
          }
        />
      ),
    },
    {
      key: "daily",
      label: t("dailyAverage"),
      content: (
        <ActivitySlide
          label={t("dailyAverage")}
          value={compact.format(dailyAverage)}
          title={formatLocaleNumber(dailyAverage, locale)}
          notes={
            <>
              {peak === null ? null : (
                <span>
                  {t("peak", {
                    value: compact.format(peak.measurements),
                    date: day.format(new Date(`${peak.date}T00:00:00Z`)),
                  })}
                </span>
              )}
              <span>{t("activeDays", { active: scoped.activeDays, total: windowDays })}</span>
            </>
          }
          chart={
            <TrendSparkline
              days={scoped.activity}
              mark="bars"
              peakDate={peak?.date ?? null}
              seriesName={t("dashboard.activity.trend")}
              locale={locale}
              className="h-11 w-full"
            />
          }
        />
      ),
    },
    {
      key: "experiments",
      label: t("dashboard.activity.experimentsLabel"),
      content: (
        <ActivitySlide
          label={t("dashboard.activity.experimentsLabel")}
          value={formatLocaleNumber(scoped.activeExperiments30d, locale)}
          notes={
            <>
              {countLine("contributors", scoped.contributors30d)}
              {scoped.devices30d === null ? null : countLine("devices", scoped.devices30d)}
            </>
          }
        />
      ),
    },
  ];

  if (community !== null) {
    slides.push({
      key: "community",
      label: t("dashboard.activity.communityLabel"),
      content: (
        <ActivitySlide
          label={t("dashboard.activity.communityLabel")}
          value={compact.format(community.measurements30d)}
          title={formatLocaleNumber(community.measurements30d, locale)}
          notes={
            <>
              {countLine("activeExperiments", community.activeExperiments30d)}
              {countLine("contributors", community.contributors30d)}
              {countLine("devices", community.devices30d)}
              {countLine("institutions", community.institutions30d)}
            </>
          }
        />
      ),
    });
  }

  const showSlide = (index: number) => api?.scrollTo(index);

  const renderSlide = (slide: Slide) => (
    <CarouselItem key={slide.key} aria-label={slide.label}>
      {slide.content}
    </CarouselItem>
  );

  return (
    <DashboardSection id="last-30-days" title={t("dashboard.activity.title")}>
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        aria-label={t("dashboard.activity.title")}
        // Rotating slides would talk over the reader; a paused one is announced.
        aria-live={rotation.isRunning ? "off" : "polite"}
        {...rotation.holdHandlers}
      >
        <CarouselContent>{slides.map(renderSlide)}</CarouselContent>
      </Carousel>
      <ActivityCarouselControls
        labels={slides.map((slide) => slide.label)}
        selected={rotation.selected}
        onSelect={showSlide}
        isRunning={rotation.isRunning}
        onToggleRunning={rotation.toggleRunning}
      />
    </DashboardSection>
  );
}
