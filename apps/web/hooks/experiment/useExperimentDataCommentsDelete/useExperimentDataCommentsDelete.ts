import { tsr } from "~/lib/tsr";

export const useExperimentDataCommentsDelete = () => {
  return tsr.experiments.deleteExperimentDataComments.useMutation();
};
