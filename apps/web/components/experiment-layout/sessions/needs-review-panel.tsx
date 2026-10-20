import type {
  Measurer,
  PlotConflict,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { ConflictCard } from "./conflict-card";
import type { FieldPlan } from "./field-plan";

interface NeedsReviewPanelProps {
  plan: FieldPlan;
  conflicts: readonly PlotConflict[];
  measurers: readonly Measurer[];
}

export function NeedsReviewPanel({ plan, conflicts, measurers }: NeedsReviewPanelProps) {
  const { t } = useTranslation("fieldSessions");
  const unresolved = conflicts.filter((conflict) => conflict.resolvedAt === null);

  const renderConflict = (conflict: PlotConflict) => (
    <ConflictCard
      key={conflict.id}
      conflict={conflict}
      plot={plan.identifierOf(conflict.unitId)}
      measurers={measurers}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("review.title")}</CardTitle>
        <CardDescription>{t("review.description")}</CardDescription>
        <CardAction>
          <Badge className="bg-status-stale text-status-stale-foreground">
            {t("review.unresolved", { count: unresolved.length })}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">{unresolved.map(renderConflict)}</CardContent>
    </Card>
  );
}
