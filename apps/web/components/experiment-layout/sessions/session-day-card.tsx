import type { Measurer } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";

import type { FieldPlan } from "./field-plan";
import { MeasuredTwicePanel } from "./measured-twice-panel";
import type { SessionDay, SessionTally } from "./session-day";
import { SessionFieldMap } from "./session-field-map";
import { SessionTallyRow } from "./session-tally-row";
import { TreatmentCoveragePanel } from "./treatment-coverage-panel";

interface SessionDayCardProps {
  plan: FieldPlan;
  measurers: readonly Measurer[];
  day: SessionDay;
}

const COLUMNS = ["assigned", "measured", "skipped", "repeats", "offPlan", "lastUpload"] as const;

export function SessionDayCard({ plan, measurers, day }: SessionDayCardProps) {
  const { t } = useTranslation("fieldSessions");

  const total = plan.plots.length;
  const covered = day.covered.size;
  const measuredTwice = day.measuredTwiceUnitIds.map((unitId) => plan.identifierOf(unitId));
  const hasMeasuredTwice = measuredTwice.length > 0;

  const summary = t("overview.summary", {
    readings: t("overview.readings", { count: day.readingCount }),
    phones: t("overview.phones", { count: day.phoneCount }),
    covered,
    total,
    skipped: day.skippedUnitIds.length,
    repeats: t("overview.repeats", { count: day.repeatCount }),
    offPlan: day.offPlanUnitIds.length,
  });

  const renderColumn = (column: (typeof COLUMNS)[number]) => (
    <TableHead key={column}>{t(`overview.columns.${column}`)}</TableHead>
  );

  const renderTally = (tally: SessionTally) => (
    <SessionTallyRow
      key={tally.session.userId}
      plan={plan}
      name={measurers.find((measurer) => measurer.userId === tally.session.userId)?.name ?? ""}
      tally={tally}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.title")}</CardTitle>
        <CardAction>
          {day.isAllUploaded ? (
            <Badge className="bg-status-active text-status-active-foreground">
              {t("overview.allUploaded")}
            </Badge>
          ) : (
            <Badge className="bg-status-stale text-status-stale-foreground">
              {t("overview.waitingCount", { count: day.waitingCount })}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm">{summary}</p>
          <Progress value={(covered / total) * 100} />
          <p className="text-muted-foreground text-xs">
            {t("overview.coveredBar", { covered, total })}
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("overview.columns.measurer")}</TableHead>
              {COLUMNS.map(renderColumn)}
            </TableRow>
          </TableHeader>
          <TableBody>{day.tallies.map(renderTally)}</TableBody>
        </Table>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px_280px]">
          <SessionFieldMap plan={plan} day={day} />
          <TreatmentCoveragePanel plan={plan} day={day} />
          {hasMeasuredTwice ? <MeasuredTwicePanel plots={measuredTwice} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
