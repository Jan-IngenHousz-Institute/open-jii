import type { ExperimentAccess } from "@repo/api/domains/experiment/experiment.schema";

export function canEditExperimentContent(access: ExperimentAccess | undefined): boolean {
  return access?.isAdmin === true && access.experiment.status !== "archived";
}
