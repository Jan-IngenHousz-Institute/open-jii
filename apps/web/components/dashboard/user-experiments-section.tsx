"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { FirstWorkCards } from "~/components/dashboard/first-work-cards";
import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";

import { listItems } from "@repo/api/shared/listing";
import { Skeleton } from "@repo/ui/components/skeleton";

import { userExperimentsQuery } from "./dashboard-queries";

export function UserExperimentsSection() {
  const { data } = useQuery(userExperimentsQuery(orpc));

  const limitedExperiments = data ? listItems(data) : undefined;

  if (!limitedExperiments) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    );
  }

  if (limitedExperiments.length === 0) {
    return <FirstWorkCards />;
  }

  return <ExperimentOverviewCards experiments={limitedExperiments} />;
}
