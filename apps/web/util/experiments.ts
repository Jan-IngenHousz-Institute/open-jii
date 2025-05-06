import type { CreateExperiment, Experiment } from "./schema";

const fixedId = "c3a70258-dc99-4382-a811-1102d688148a";

export function createExperiment(createExperiment: CreateExperiment) {
  console.log(
    "Creating experiment with name",
    createExperiment.name,
    "and id",
    fixedId,
  );
  return fixedId;
}

export function getExperiment(id: string) {
  const experiment: Experiment = {
    id: fixedId,
    name: "Test Experiment",
    private: true,
    description: "Test Experiment Description",
  };
  if (id != fixedId) return undefined;
  console.log("Getting experiment with id", id, "returning", experiment);
  return experiment;
}
