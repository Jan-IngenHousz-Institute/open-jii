import { formatHm } from "@/util/date";

import type { SessionSkip } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { TableCell, TableRow } from "@repo/ui/components/table";

import type { FieldPlan } from "./field-plan";
import type { SessionTally } from "./session-day";

interface SessionTallyRowProps {
  plan: FieldPlan;
  name: string;
  tally: SessionTally;
}

export function SessionTallyRow({ plan, name, tally }: SessionTallyRowProps) {
  const { t } = useTranslation("fieldSessions");
  const { session } = tally;

  const plots = (unitIds: readonly string[]) =>
    unitIds.map((unitId) => plan.identifierOf(unitId)).join(", ");
  const skipLabel = (skip: SessionSkip) =>
    t("overview.skipWithReason", {
      plot: plan.identifierOf(skip.unitId),
      reason: t(`overview.skipReasons.${skip.reason}`),
    });

  const renderCount = (count: number, detail: string) => (
    <>
      <span className="tabular-nums">{count}</span>
      {count > 0 ? <span className="text-muted-foreground ml-2">{detail}</span> : null}
    </>
  );

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{session.phone}</p>
      </TableCell>
      <TableCell className="tabular-nums">{session.assignedUnitIds.length}</TableCell>
      <TableCell className="tabular-nums">{tally.measured}</TableCell>
      <TableCell>
        {renderCount(tally.skips.length, tally.skips.map(skipLabel).join(", "))}
      </TableCell>
      <TableCell>{renderCount(tally.repeatUnitIds.length, plots(tally.repeatUnitIds))}</TableCell>
      <TableCell>{renderCount(tally.offPlanUnitIds.length, plots(tally.offPlanUnitIds))}</TableCell>
      <TableCell className="tabular-nums">
        {session.isUploaded ? null : (
          <Badge className="bg-status-stale text-status-stale-foreground mr-2">
            {t("overview.waiting")}
          </Badge>
        )}
        {session.lastUploadAt ? formatHm(new Date(session.lastUploadAt)) : null}
      </TableCell>
    </TableRow>
  );
}
