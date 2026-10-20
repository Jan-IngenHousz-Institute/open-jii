import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentReadinessSummaryProps {
  experimentId: string;
  experiment: Experiment;
}

export function ExperimentReadinessSummary(_props: ExperimentReadinessSummaryProps) {
  return null;
}
