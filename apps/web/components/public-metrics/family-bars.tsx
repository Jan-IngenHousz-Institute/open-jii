"use client";

import type { MetricsFamily } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

/** Publishers the device registry could not resolve to a device. */
export const UNATTRIBUTED_FAMILY = "unattributed";

interface FamilyBarsProps {
  families: MetricsFamily[];
  locale: string;
}

export function FamilyBars({ families, locale }: FamilyBarsProps) {
  const { t } = useTranslation("publicMetrics");

  const max = Math.max(...families.map((family) => family.measurements), 1);
  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  const familyLabel = (family: string) =>
    family === UNATTRIBUTED_FAMILY ? t("families.unattributed") : family;

  const renderRow = (family: MetricsFamily) => (
    <li key={family.family} className="flex items-center gap-3">
      <span className="text-foreground w-28 truncate text-sm capitalize">
        {familyLabel(family.family)}
      </span>
      <span className="bg-muted h-4 flex-1 overflow-hidden rounded">
        <span
          className="bg-primary block h-full rounded"
          style={{ width: `${(family.measurements / max) * 100}%` }}
        />
      </span>
      <span className="text-muted-foreground w-14 text-right text-sm tabular-nums">
        {formatCount(family.measurements)}
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-foreground text-sm font-medium">{t("families.title")}</h3>
      <ul className="flex flex-col gap-2">{families.map(renderRow)}</ul>
    </div>
  );
}
