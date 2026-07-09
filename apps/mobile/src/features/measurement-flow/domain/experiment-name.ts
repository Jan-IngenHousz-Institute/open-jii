// Prefer the label persisted with the flow (survives offline/cold resume) over
// the live experiments query, which loses the name when its cache lacks
// experimentId. Query then generic default are fallbacks for legacy flows.
export interface ExperimentOption {
  value: string;
  label: string;
}

export function resolveExperimentName(args: {
  experimentLabel: string | undefined;
  experiments: ExperimentOption[];
  experimentId: string | undefined;
  fallback: string;
}): string {
  const { experimentLabel, experiments, experimentId, fallback } = args;
  if (experimentLabel?.trim()) return experimentLabel;
  const fromQuery = experimentId
    ? experiments.find((e) => e.value === experimentId)?.label
    : undefined;
  return fromQuery ?? fallback;
}
