"use client";

import { useExperimentSessionAssignments } from "@/hooks/experiment/useExperimentSessionAssignments/useExperimentSessionAssignments";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";

import { Skeleton } from "@repo/ui/components/skeleton";

import { DivideFieldWorkspace } from "./divide-field-workspace";
import type { FieldPlan } from "./field-plan";
import { LoadFailed } from "./load-failed";

interface DivideFieldSectionProps {
  experimentId: string;
  canEdit: boolean;
  plan: FieldPlan;
}

export function DivideFieldSection({ experimentId, canEdit, plan }: DivideFieldSectionProps) {
  const measurers = useExperimentSessionMeasurers(experimentId);
  const assignments = useExperimentSessionAssignments(experimentId);

  const retry = () => {
    void measurers.refetch();
    void assignments.refetch();
  };

  if (measurers.isLoading || assignments.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!measurers.data || assignments.isError) {
    return <LoadFailed onRetry={retry} />;
  }

  return (
    <DivideFieldWorkspace
      plan={plan}
      canEdit={canEdit}
      measurers={measurers.data}
      assignments={assignments.data ?? null}
    />
  );
}
