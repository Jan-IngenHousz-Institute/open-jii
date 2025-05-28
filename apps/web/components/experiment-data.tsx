"use client";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";
import { ErrorDisplay } from "./error-display";

interface ExperimentDataProps {
  experimentId: string;
}

export function ExperimentData({ experimentId }: ExperimentDataProps) {
  const { data, isLoading, error } = useExperiment(experimentId);

  if (isLoading) {
    return <div>Loading experiment data...</div>;
  }

  if (error) {
    return (
      <ErrorDisplay error={error} title="Failed to load experiment data" />
    );
  }

  if (!data) {
    return <div>Experiment not found</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">Experiment Data</h4>
        <p className="text-muted-foreground text-sm">
          View and manage data associated with this experiment.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">Data Sources</h5>
          <div className="text-muted-foreground text-sm">
            <p>No data sources configured yet.</p>
            <p className="mt-2">
              This section will show datasets, files, and other data sources
              associated with your experiment.
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">Data Collection</h5>
          <div className="text-muted-foreground text-sm">
            <p>Data collection status: Not started</p>
            <p className="mt-2">
              Configure data collection settings and monitor progress here.
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">Data Analysis</h5>
          <div className="text-muted-foreground text-sm">
            <p>No analysis results available.</p>
            <p className="mt-2">
              Analysis results and reports will appear here once data collection
              begins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
