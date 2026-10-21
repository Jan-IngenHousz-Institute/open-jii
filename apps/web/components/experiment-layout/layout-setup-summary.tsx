import { Pencil } from "lucide-react";

import type { ExperimentLayout } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";

import { LayoutCount } from "./layout-count";
import { LayoutNamingScheme } from "./layout-naming";
import { UnitName } from "./unit-name";

interface LayoutSetupSummaryProps {
  layout: ExperimentLayout;
  /** Opens the setup form again, offered only to those who can edit the layout. */
  onEdit?: () => void;
}

/** The setup card once plots exist: what the layout is, in one line, with Edit. */
export function LayoutSetupSummary({ layout, onEdit }: LayoutSetupSummaryProps) {
  const { t } = useTranslation("experiments");

  const unitName = new UnitName(layout.levelName);
  const plotCount = layout.units.filter((unit) => unit.active).length;
  const placedCount = layout.units.filter(
    (unit) => unit.active && unit.row !== null && unit.column !== null,
  ).length;
  const gapCount = layout.rows * layout.columns - placedCount;
  const readingCount = layout.readingCount ?? 0;
  const hasReadings = readingCount > 0;
  const naming =
    layout.naming === null || layout.naming === undefined
      ? null
      : new LayoutNamingScheme(layout.naming, layout.columns, layout.firstNumber ?? 1).range(
          layout.rows,
        );

  return (
    <Card
      padding="none"
      className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
    >
      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">{t("layout.summaryCard.size")}</dt>
          <dd className="font-medium">
            {t("layout.summaryCard.sizeValue", { rows: layout.rows, columns: layout.columns })}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">{t("layout.summaryCard.names")}</dt>
          <dd className="font-medium">
            {naming === null
              ? t("layout.summaryCard.pastedNames")
              : t("layout.summaryCard.namesValue", naming)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">
            {t("layout.summaryCard.plots", { units: unitName.plural })}
          </dt>
          <dd className="font-medium">
            <LayoutCount levelName={layout.levelName} plots={plotCount} gaps={gapCount} />
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">{t("layout.summaryCard.readings")}</dt>
          <dd className="font-medium">
            {hasReadings
              ? t("layout.summaryCard.readingsValue", { count: readingCount, unit: unitName.lower })
              : t("layout.summaryCard.noReadings", { unit: unitName.lower })}
          </dd>
        </div>
      </dl>
      {onEdit === undefined ? null : (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
          {t("layout.summaryCard.edit")}
        </Button>
      )}
    </Card>
  );
}
