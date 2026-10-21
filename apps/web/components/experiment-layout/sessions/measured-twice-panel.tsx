import { formatHm } from "@/util/date";

import type {
  MeasuredTwicePlot,
  Measurer,
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

import type { FieldPlan } from "./field-plan";
import { MeasuredTwiceItem } from "./measured-twice-item";

/** Where the day overview's "Resolve" link lands. */
export const MEASURED_TWICE_ANCHOR = "measured-twice";

interface MeasuredTwicePanelProps {
  plan: FieldPlan;
  plots: readonly MeasuredTwicePlot[];
  measurers: readonly Measurer[];
  canEdit: boolean;
}

/** The Field days view's side panel for plots more than one reading landed on without a repeat. */
export function MeasuredTwicePanel({ plan, plots, measurers, canEdit }: MeasuredTwicePanelProps) {
  const { t } = useTranslation("fieldSessions");

  const open = plots.filter((plot) => plot.resolution === null);
  const resolved = plots.filter((plot) => plot.resolution !== null);
  const hasOpen = open.length > 0;
  const hasResolved = resolved.length > 0;

  const nameOf = (userId: string) =>
    measurers.find((measurer) => measurer.userId === userId)?.name ?? "";
  const plotName = (unitId: string) =>
    t("unitName", { level: plan.layout.levelName, plot: plan.identifierOf(unitId) });

  const renderOpen = (plot: MeasuredTwicePlot) => (
    <MeasuredTwiceItem
      key={plot.id}
      plot={plot}
      plotName={plotName(plot.unitId)}
      nameOf={nameOf}
      canEdit={canEdit}
    />
  );

  const renderResolved = (plot: MeasuredTwicePlot) => {
    const kept = plot.readings.find(
      (reading) => reading.readingId === plot.resolution?.keptReadingId,
    );
    return (
      <li key={plot.id} className="space-y-0.5 text-sm">
        <p>
          {t("measuredTwice.resolved", {
            plot: plotName(plot.unitId),
            kept: nameOf(kept?.userId ?? ""),
          })}
        </p>
        {plot.resolution ? (
          <p className="text-muted-foreground text-xs">
            {t("measuredTwice.resolvedBy", {
              name: nameOf(plot.resolution.resolvedBy),
              time: formatHm(new Date(plot.resolution.resolvedAt)),
            })}
          </p>
        ) : null}
      </li>
    );
  };

  return (
    <Card id={MEASURED_TWICE_ANCHOR}>
      <CardHeader>
        <CardTitle>{t("measuredTwice.title")}</CardTitle>
        <CardDescription>{t("measuredTwice.description")}</CardDescription>
        {hasOpen ? (
          <CardAction>
            <Badge className="bg-status-stale text-status-stale-foreground">
              {t("measuredTwice.toResolve", { count: open.length })}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasOpen ? (
          open.map(renderOpen)
        ) : (
          <p className="text-muted-foreground text-sm">
            {hasResolved ? t("measuredTwice.noneOpen") : t("measuredTwice.none")}
          </p>
        )}
        {hasResolved ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">{t("measuredTwice.resolvedTitle")}</p>
            <ul className="space-y-2">{resolved.map(renderResolved)}</ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
