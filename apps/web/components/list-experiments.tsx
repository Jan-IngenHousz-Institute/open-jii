"use client";

import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import type { ExperimentStatus } from "@repo/api";
import { zExperimentStatus } from "@repo/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components";

export function ListExperiments() {
  const { data, filter, setFilter, status, setStatus } = useExperiments({});

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-8">
        <Select
          defaultValue="my"
          value={filter}
          onValueChange={(value: "my" | "member" | "related" | "all") => setFilter(value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter experiments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="my">My Experiments</SelectItem>
            <SelectItem value="member">Member Experiments</SelectItem>
            <SelectItem value="related">All Related Experiments</SelectItem>
            <SelectItem value="all">All Experiments</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status ?? "all"}
          onValueChange={(v) => setStatus(v === "all" ? undefined : (v as ExperimentStatus))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.values(zExperimentStatus.enum).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ExperimentOverviewCards experiments={data?.body} />
    </div>
  );
}
