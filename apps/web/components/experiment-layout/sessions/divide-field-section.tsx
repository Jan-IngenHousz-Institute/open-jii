"use client";

import { useExperimentSessionAssignments } from "@/hooks/experiment/useExperimentSessionAssignments/useExperimentSessionAssignments";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";

import { Skeleton } from "@repo/ui/components/skeleton";

import { DivideFieldWorkspace } from "./divide-field-workspace";
import type { SessionsViewProps } from "./sessions-view";

export function DivideFieldSection({ experimentId, plan }: SessionsViewProps) {
  const { data: measurers, isLoading: isMeasurersLoading } =
    useExperimentSessionMeasurers(experimentId);
  const { data: assignments, isLoading: isAssignmentsLoading } =
    useExperimentSessionAssignments(experimentId);

  if (isMeasurersLoading || isAssignmentsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!measurers || !assignments) {
    return null;
  }

  return <DivideFieldWorkspace plan={plan} measurers={measurers} assignments={assignments} />;
}
