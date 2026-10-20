"use client";

import { useExperimentSessionConflicts } from "@/hooks/experiment/useExperimentSessionConflicts/useExperimentSessionConflicts";
import { useExperimentSessionMeasurers } from "@/hooks/experiment/useExperimentSessionMeasurers/useExperimentSessionMeasurers";

import { Skeleton } from "@repo/ui/components/skeleton";

import { NeedsReviewPanel } from "./needs-review-panel";
import { ReviewGrid } from "./review-grid";
import type { SessionsViewProps } from "./sessions-view";

export function NeedsReviewSection({ experimentId, plan }: SessionsViewProps) {
  const { data: measurers, isLoading: isMeasurersLoading } =
    useExperimentSessionMeasurers(experimentId);
  const { data: conflicts, isLoading: isConflictsLoading } =
    useExperimentSessionConflicts(experimentId);

  if (isMeasurersLoading || isConflictsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // The panel appears only while a plot is in conflict.
  if (!measurers || !conflicts || conflicts.length === 0) {
    return null;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px]">
      <ReviewGrid plan={plan} conflicts={conflicts} />
      <NeedsReviewPanel plan={plan} conflicts={conflicts} measurers={measurers} />
    </div>
  );
}
