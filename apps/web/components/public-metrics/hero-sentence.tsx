"use client";

import type { MetricsHero } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

interface HeroSentenceProps {
  hero: MetricsHero;
  locale: string;
}

function formatVolume(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

export function HeroSentence({ hero, locale }: HeroSentenceProps) {
  const { t } = useTranslation("publicMetrics");

  const measurements = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(hero.totalMeasurements);

  return (
    <p className="text-foreground max-w-2xl text-2xl leading-snug md:text-3xl">
      <Trans
        t={t}
        i18nKey="hero.sentence"
        values={{
          measurements,
          volume: formatVolume(hero.totalVolumeBytes, locale),
          timezones: hero.timezonesSpanned,
        }}
        components={{ em: <b className="text-primary font-semibold" /> }}
      />
    </p>
  );
}
