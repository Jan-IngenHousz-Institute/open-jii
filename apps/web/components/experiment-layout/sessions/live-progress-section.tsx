"use client";

import { useExperimentSessionAssignments } from "@/hooks/experiment/useExperimentSessionAssignments/useExperimentSessionAssignments";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";
import { useExperimentSessionProgress } from "@/hooks/experiment/useExperimentSessionProgress/useExperimentSessionProgress";

import { Skeleton } from "@repo/ui/components/skeleton";

import { FieldShares } from "./field-shares";
import { LiveProgressCard } from "./live-progress-card";
import { ProgressGrid } from "./progress-grid";
import type { SessionsViewProps } from "./sessions-view";

export function LiveProgressSection({ experimentId, plan }: SessionsViewProps) {
  const { data: measurers, isLoading: isMeasurersLoading } =
    useExperimentSessionMeasurers(experimentId);
  const { data: assignments, isLoading: isAssignmentsLoading } =
    useExperimentSessionAssignments(experimentId);
  const { data: progress, isLoading: isProgressLoading } =
    useExperimentSessionProgress(experimentId);

  if (isMeasurersLoading || isAssignmentsLoading || isProgressLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Live progress shows only while a session is open.
  if (!measurers || !assignments || !progress) {
    return null;
  }

  const shares = new FieldShares(assignments.shares);

  return (
    <div className="space-y-6">
      <LiveProgressCard plan={plan} measurers={measurers} shares={shares} progress={progress} />
      <ProgressGrid plan={plan} measurers={measurers} shares={shares} progress={progress} />
    </div>
  );
}
