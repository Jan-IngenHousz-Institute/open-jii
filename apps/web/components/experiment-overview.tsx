"use client";

import { formatDate } from "@/util/date";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";

interface ExperimentOverviewProps {
  experimentId: string;
}

export function ExperimentOverview({ experimentId }: ExperimentOverviewProps) {
  const { data, isLoading } = useExperiment(experimentId);

  if (isLoading) {
    return <div>Loading experiment details...</div>;
  }

  if (!data) {
    return <div>Experiment not found</div>;
  }

  const experiment = data.body;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h4 className="text-muted-foreground text-sm font-medium">Name</h4>
            <p className="text-lg">{experiment.name}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Description
            </h4>
            <p className="text-sm">
              {experiment.description ?? "No description provided"}
            </p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Status
            </h4>
            <p className="text-sm capitalize">{experiment.status}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Visibility
            </h4>
            <p className="text-sm capitalize">{experiment.visibility}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Embargo Period
            </h4>
            <p className="text-sm">{experiment.embargoIntervalDays} days</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Created
            </h4>
            <p className="text-sm">{formatDate(experiment.createdAt)}</p>
          </div>

          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Last Updated
            </h4>
            <p className="text-sm">{formatDate(experiment.updatedAt)}</p>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="text-muted-foreground mb-2 text-sm font-medium">
          Experiment ID
        </h4>
        <p className="bg-muted rounded p-2 font-mono text-sm">
          {experiment.id}
        </p>
      </div>
    </div>
  );
}
