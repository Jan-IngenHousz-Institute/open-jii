import { TriangleAlert } from "lucide-react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type { PlotConflict } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import type { FieldPlan } from "./field-plan";
import { SessionGrid } from "./session-grid";
import { SessionGridCell } from "./session-grid-cell";

interface ReviewGridProps {
  plan: FieldPlan;
  conflicts: readonly PlotConflict[];
}

export function ReviewGrid({ plan, conflicts }: ReviewGridProps) {
  const { t } = useTranslation("fieldSessions");
  const inConflict = new Set(
    conflicts.filter((conflict) => conflict.resolvedAt === null).map((conflict) => conflict.unitId),
  );

  const conflictMarker = (
    <TriangleAlert
      aria-label={t("review.marker")}
      className="text-status-stale-foreground fill-status-stale size-3.5"
    />
  );

  const renderCell = (unit: ExperimentUnit | undefined) => (
    <SessionGridCell
      unit={unit}
      marker={unit && inConflict.has(unit.id) ? conflictMarker : undefined}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>{t("plotCount", { count: plan.plots.length })}</CardDescription>
      </CardHeader>
      <CardContent>
        <SessionGrid layout={plan.layout} renderCell={renderCell} />
      </CardContent>
    </Card>
  );
}
