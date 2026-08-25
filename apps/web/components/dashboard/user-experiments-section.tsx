"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";

import { listItems } from "@repo/api/shared/listing";
import { Skeleton } from "@repo/ui/components/skeleton";

export function UserExperimentsSection() {
  const { data } = useQuery(
    orpc.experiments.listExperiments.queryOptions({ input: { scope: "related" } }),
  );

  // Show only first 3 experiments for dashboard
  const limitedExperiments = data ? listItems(data).slice(0, 3) : undefined;

  return (
    <div className="space-y-4">
      {data ? (
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
