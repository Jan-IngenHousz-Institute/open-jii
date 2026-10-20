"use client";

import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";
import { useExperimentSessionsEnded } from "@/hooks/experiment/useExperimentSessionsEnded/useExperimentSessionsEnded";

import { Skeleton } from "@repo/ui/components/skeleton";

import { SessionDay } from "./session-day";
import { SessionDayCard } from "./session-day-card";
import type { SessionsViewProps } from "./sessions-view";

export function SessionOverviewSection({ experimentId, plan }: SessionsViewProps) {
  const { data: measurers, isLoading: isMeasurersLoading } =
    useExperimentSessionMeasurers(experimentId);
  const { data: sessions, isLoading: isSessionsLoading } = useExperimentSessionsEnded(
    experimentId,
    new Date(),
  );

  if (isMeasurersLoading || isSessionsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // The overview appears once a session has ended today.
  if (!measurers || !sessions || sessions.length === 0) {
    return null;
  }

  return <SessionDayCard plan={plan} measurers={measurers} day={new SessionDay(plan, sessions)} />;
}
