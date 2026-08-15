"use client";

import type { PublicFamilyTotals } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

interface FamilyBreakdownProps {
  families: PublicFamilyTotals[];
  locale: string;
}

export function FamilyBreakdown({ families, locale }: FamilyBreakdownProps) {
  const { t } = useTranslation("publicMetrics");

  const maxMeasurements = Math.max(...families.map((family) => family.totalMeasurements), 1);

  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  const familyLabel = (family: string) =>
    family === "unattributed" ? t("families.unattributed") : family;

  const renderRow = (family: PublicFamilyTotals) => (
    <li key={family.family} className="flex items-center gap-3">
      <span className="text-foreground w-28 truncate text-sm capitalize">
        {familyLabel(family.family)}
      </span>
      <span className="bg-muted h-4 flex-1 overflow-hidden rounded">
        <span
          className="bg-primary block h-full rounded"
          style={{ width: `${(family.totalMeasurements / maxMeasurements) * 100}%` }}
        />
      </span>
      <span className="text-muted-foreground w-14 text-right text-sm tabular-nums">
        {formatCount(family.totalMeasurements)}
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-foreground text-sm font-medium">{t("charts.familyTitle")}</h3>
      <ul className="flex flex-col gap-2">{families.map(renderRow)}</ul>
    </div>
  );
}
