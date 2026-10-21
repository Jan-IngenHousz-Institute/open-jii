"use client";

import { useExperimentMeasuredTwice } from "@/hooks/experiment/useExperimentMeasuredTwice/useExperimentMeasuredTwice";
import { useExperimentSessionDays } from "@/hooks/experiment/useExperimentSessionDays/useExperimentSessionDays";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";
import { useExperimentSessionsEnded } from "@/hooks/experiment/useExperimentSessionsEnded/useExperimentSessionsEnded";
import { CalendarX } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { FieldDaysEmptyState } from "../field-days-empty-state";
import { DaySelector } from "./day-selector";
import { FieldDaysGrid } from "./field-days-grid";
import type { FieldPlan } from "./field-plan";
import { FieldShares } from "./field-shares";
import { LoadFailed } from "./load-failed";
import { MeasuredTwicePanel } from "./measured-twice-panel";
import { SessionDay } from "./session-day";
import { SessionDayCard } from "./session-day-card";

interface EndedDayProps {
  experimentId: string;
  canEdit: boolean;
  plan: FieldPlan;
}

/** A chosen field day after its sessions ended: the overview, the field map and plots measured twice. */
export function EndedDay({ experimentId, canEdit, plan }: EndedDayProps) {
  const { t } = useTranslation("fieldSessions");
  const [chosenDay, setChosenDay] = useState<string | undefined>(undefined);

  const days = useExperimentSessionDays(experimentId);
  const day = chosenDay ?? days.data?.[0];
  const measurers = useExperimentSessionMeasurers(experimentId);
  const sessions = useExperimentSessionsEnded(experimentId, day);
  const measuredTwice = useExperimentMeasuredTwice(experimentId);

  const retry = () => {
    void days.refetch();
    void measurers.refetch();
    void sessions.refetch();
    void measuredTwice.refetch();
  };

  const isLoading =
    days.isLoading ||
    measurers.isLoading ||
    measuredTwice.isLoading ||
    (day !== undefined && sessions.isLoading);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!days.data || !measurers.data || !measuredTwice.data || sessions.isError) {
    return <LoadFailed onRetry={retry} />;
  }

  if (day === undefined) {
    return <FieldDaysEmptyState />;
  }

  const sessionDay = new SessionDay(plan, sessions.data ?? []);
  const hasSessions = sessionDay.sessions.length > 0;
  const shares = new FieldShares(
    sessionDay.sessions.map((session) => ({
      userId: session.userId,
      unitIds: session.assignedUnitIds,
    })),
    measurers.data,
  );

  const markOf = (unitId: string) => sessionDay.markOf(unitId);

  const status = !hasSessions ? null : sessionDay.isAllUploaded ? (
    <Badge className="bg-status-active text-status-active-foreground">
      {t("overview.allUploaded")}
    </Badge>
  ) : (
    <Badge className="bg-status-stale text-status-stale-foreground">
      {t("overview.waitingCount", { count: sessionDay.waitingCount })}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <DaySelector days={days.data} value={day} onChange={setChosenDay} status={status} />

      {hasSessions ? (
        <SessionDayCard plan={plan} shares={shares} day={sessionDay} />
      ) : (
        <EmptyState
          icon={<CalendarX aria-hidden />}
          title={t("fieldDays.noSessionTitle")}
          description={t("fieldDays.noSessionDescription")}
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <FieldDaysGrid
          plan={plan}
          description={t("overview.gridDescription", {
            measured: sessionDay.measured.size,
            total: plan.plots.length,
          })}
          markOf={markOf}
          shares={hasSessions ? shares : undefined}
        />
        <MeasuredTwicePanel
          plan={plan}
          plots={measuredTwice.data}
          measurers={measurers.data}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
