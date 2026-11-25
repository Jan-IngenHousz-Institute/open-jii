import type { ExperimentAccess } from "@repo/api/domains/experiment/experiment.schema";

export function canDuplicateExperimentChart(access: ExperimentAccess | undefined): boolean {
  return access?.isAdmin === true && access.experiment.status !== "archived";
}
