"use client";

import type { MetricsParameter } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

interface ParameterLineProps {
  parameter: MetricsParameter;
  locale: string;
}

export function ParameterLine({ parameter, locale }: ParameterLineProps) {
  const { t } = useTranslation("publicMetrics");

  return (
    <p className="text-muted-foreground text-sm">
      <Trans
        t={t}
        i18nKey="parameter.sentence"
        values={{
          name: parameter.name,
          count: new Intl.NumberFormat(locale).format(parameter.count30d),
          median: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
            parameter.median,
          ),
        }}
        components={{ em: <b className="text-primary font-semibold" /> }}
      />
    </p>
  );
}
