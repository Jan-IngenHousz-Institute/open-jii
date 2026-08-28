"use client";

import type { MetricsCommunity } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

interface CommunityLineProps {
  community: MetricsCommunity;
  locale: string;
}

export function CommunityLine({ community, locale }: CommunityLineProps) {
  const { t } = useTranslation("publicMetrics");
  const format = (value: number) => new Intl.NumberFormat(locale).format(value);

  return (
    <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
      <Trans
        t={t}
        i18nKey="community.sentence"
        values={{
          measurements: format(community.measurements30d),
          experiments: format(community.activeExperiments30d),
          contributors: format(community.contributors30d),
          institutions: format(community.institutions30d),
        }}
        components={{ em: <b className="text-primary font-semibold" /> }}
      />
    </p>
  );
}
