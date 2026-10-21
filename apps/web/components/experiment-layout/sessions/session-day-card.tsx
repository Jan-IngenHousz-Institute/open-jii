import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";

import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { MEASURED_TWICE_ANCHOR } from "./measured-twice-panel";
import type { SessionDay, SessionTally } from "./session-day";
import { SessionTallyRow } from "./session-tally-row";
import { TreatmentCoveragePanel } from "./treatment-coverage-panel";

interface SessionDayCardProps {
  plan: FieldPlan;
  shares: FieldShares;
  day: SessionDay;
}

const COLUMNS = [
  "measurer",
  "assigned",
  "measured",
  "skipped",
  "repeats",
  "outsideShare",
  "lastUpload",
] as const;

/** What one field day measured, skipped and repeated, per measurer and in total. */
export function SessionDayCard({ plan, shares, day }: SessionDayCardProps) {
  const { t } = useTranslation("fieldSessions");

  const total = plan.plots.length;
  const measured = day.measured.size;
  const measuredTwice = day.measuredTwiceUnitIds.map((unitId) => plan.identifierOf(unitId));
  const hasMeasuredTwice = measuredTwice.length > 0;

  const summary = t("overview.summary", {
    readings: t("overview.readings", { count: day.readingCount }),
    phones: t("overview.phones", { count: day.phoneCount }),
    measured,
    total,
    skipped: day.skippedUnitIds.length,
    repeats: t("overview.repeats", { count: day.repeatCount }),
    outside: t("overview.outsideShare", { count: day.outsideShareUnitIds.length }),
    twice: t("overview.measuredTwice", { count: measuredTwice.length }),
  });

  const renderColumn = (column: (typeof COLUMNS)[number]) => (
    <TableHead key={column}>{t(`overview.columns.${column}`)}</TableHead>
  );

  const renderTally = (tally: SessionTally) => (
    <SessionTallyRow
      key={tally.session.userId}
      plan={plan}
      name={shares.nameOf(tally.session.userId)}
      style={shares.styleOf(tally.session.userId)}
      tally={tally}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm">{summary}</p>
          <Progress value={(measured / total) * 100} />
          <p className="text-muted-foreground text-xs">
            {t("overview.measuredBar", { measured, total })}
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>{COLUMNS.map(renderColumn)}</TableRow>
          </TableHeader>
          <TableBody>{day.tallies.map(renderTally)}</TableBody>
        </Table>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <TreatmentCoveragePanel plan={plan} day={day} />
          {hasMeasuredTwice ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("overview.measuredTwiceTitle")}</p>
              <p className="text-muted-foreground text-sm">
                {t("overview.measuredTwiceLine", { plots: measuredTwice.join(", ") })}
              </p>
              <Button asChild variant="outline" size="sm">
                <a href={`#${MEASURED_TWICE_ANCHOR}`}>{t("overview.resolve")}</a>
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
