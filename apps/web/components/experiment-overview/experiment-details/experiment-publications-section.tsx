import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentPublicationsSectionProps {
  experimentId: string;
  experiment: Experiment;
  hasAccess: boolean;
}

export function ExperimentPublicationsSection(_props: ExperimentPublicationsSectionProps) {
  return null;
}
