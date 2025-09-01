import { tsr } from "~/lib/tsr";

export const useExperimentDataCommentsCreate = () => {
  return tsr.experiments.createExperimentDataComments.useMutation();
};
