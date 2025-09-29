"use client";

import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import { Skeleton } from "@repo/ui/components";

export function UserExperimentsSection() {
  // Get only user's experiments (my experiments) with a limit for dashboard view
  const { data } = useExperiments({
    initialFilter: "my",
    initialStatus: undefined,
    initialSearch: "",
  });

  // Show only first 3 experiments for dashboard
  const limitedExperiments = data?.body ? data.body.slice(0, 3) : undefined;

  return (
    <div className="space-y-4">
      {data?.body ? (
        <ExperimentOverviewCards experiments={limitedExperiments} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      )}
    </div>
  );
}
