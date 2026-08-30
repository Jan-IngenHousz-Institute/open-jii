"use client";

import type { MetricsParameter } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";

interface ParameterLineProps {
  parameter: MetricsParameter;
  kind: "derived" | "sensor";
  locale: string;
}

export function ParameterLine({ parameter, kind, locale }: ParameterLineProps) {
  const { t } = useTranslation("publicMetrics");

  return (
    <p className="text-muted-foreground text-sm">
      <Trans
        t={t}
        i18nKey={kind === "derived" ? "parameter.derivedSentence" : "parameter.sensorSentence"}
        values={{
          name: parameter.label,
          count: new Intl.NumberFormat(locale).format(parameter.observations),
          median: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
            parameter.median,
          ),
        }}
        components={{ em: <b className="text-primary font-semibold" /> }}
      />
    </p>
  );
}
