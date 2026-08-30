"use client";

import type { PublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { ActivityChart } from "./activity-chart";
import { ActivityIndicator } from "./activity-indicator";
import { CaptionRotator } from "./caption-rotator";
import { CommunityLine } from "./community-line";
import { FamilyBars, UNATTRIBUTED_FAMILY } from "./family-bars";
import { HeroSentence } from "./hero-sentence";
import { ParameterLine } from "./parameter-line";

interface PublicMetricsSectionProps {
  metrics: PublicMetricsResponse;
  locale: string;
}

/**
 * The landing-page composition; visual treatment iterates on this skeleton.
 * Every block is individually conditional so the section degrades instead of
 * rendering zeros before the pipeline's first refresh.
 */
export function PublicMetricsSection({ metrics, locale }: PublicMetricsSectionProps) {
  const { t } = useTranslation("publicMetrics");
  const {
    hero,
    liveness,
    community,
    activity,
    families,
    derivedParameter,
    sensorParameter,
    captions,
  } = metrics;

  const instruments = families.filter((family) => family.family !== UNATTRIBUTED_FAMILY);
  const attributed = instruments.reduce((sum, family) => sum + family.measurements, 0);
  const total = families.reduce((sum, family) => sum + family.measurements, 0);
  // While the registry resolves a minority of publishers, an instrument
  // breakdown describes a sliver of the pool and reads as the whole of it.
  const showInstruments = instruments.length > 0 && attributed * 2 > total;

  const hasAnything = hero !== null || community !== null || activity.length > 0;
  if (!hasAnything) {
    return null;
  }

  return (
    <section className="w-full max-w-5xl px-4 py-16 md:px-8">
      <div className="mb-8 flex flex-col gap-4">
        <h2 className="sr-only">{t("title")}</h2>
        {liveness ? (
          <ActivityIndicator
            measurements24h={liveness.measurements24h}
            lastMeasurementAt={liveness.lastMeasurementAt}
            locale={locale}
          />
        ) : null}
        <div className="flex flex-col gap-4">
          {hero ? <HeroSentence hero={hero} locale={locale} /> : null}
          {community ? <CommunityLine community={community} locale={locale} /> : null}
        </div>
      </div>

      {activity.length > 1 ? (
        <div className="border-border border-t pt-6">
          <ActivityChart data={activity} locale={locale} />
        </div>
      ) : null}

      <div
        className={cn(
          "border-border mt-8 grid gap-8 border-t pt-6",
          showInstruments && "md:grid-cols-2",
        )}
      >
        {showInstruments ? <FamilyBars families={instruments} locale={locale} /> : null}
        <div className="flex flex-col gap-4">
          {derivedParameter ? (
            <ParameterLine parameter={derivedParameter} kind="derived" locale={locale} />
          ) : null}
          {sensorParameter ? (
            <ParameterLine parameter={sensorParameter} kind="sensor" locale={locale} />
          ) : null}
          <CaptionRotator captions={captions} locale={locale} />
        </div>
      </div>
    </section>
  );
}
