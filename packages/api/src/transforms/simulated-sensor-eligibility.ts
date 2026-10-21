import type { Experiment } from "../domains/experiment/experiment.schema";

export function simulatedSensorsEnabled(
  experiment: Pick<Experiment, "organizationType"> | null | undefined,
): boolean {
  return experiment?.organizationType === "demo";
}
