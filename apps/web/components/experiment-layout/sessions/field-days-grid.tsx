import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import type { PlotMark } from "../plot-state";
import { PLOT_MARKS } from "../plot-state";
import { PlotStateCell } from "../plot-state-cell";
import { PlotStateLegend } from "../plot-state-legend";
import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { SessionGrid } from "./session-grid";

interface FieldDaysGridProps {
  plan: FieldPlan;
  description: string;
  markOf: (unitId: string) => PlotMark | undefined;
  shares?: FieldShares;
}

/** The Field days view's grid: treatment as fill, share as border, a glyph for each plot's state. */
export function FieldDaysGrid({ plan, description, markOf, shares }: FieldDaysGridProps) {
  const { t } = useTranslation("fieldSessions");

  // The legend names only the glyphs this grid shows.
  const shown = new Set(plan.plots.map((plot) => markOf(plot.id)));
  const entries = PLOT_MARKS.filter((mark) => shown.has(mark));

  const renderCell = (unit: ExperimentUnit | undefined) =>
    unit === undefined || !unit.active ? (
      <PlotStateCell kind="gap" />
    ) : (
      <PlotStateCell
        kind="plot"
        identifier={unit.identifier}
        category={plan.categories.get(plan.treatmentOf(unit.id))}
        share={shares?.styleOfPlot(unit.id)}
        mark={markOf(unit.id)}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SessionGrid layout={plan.layout} renderCell={renderCell} />
        <div className="border-t pt-4">
          <PlotStateLegend
            categoryName={t("treatment")}
            categories={plan.categories}
            shares={shares?.legend}
            entries={[...entries, "gap"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
