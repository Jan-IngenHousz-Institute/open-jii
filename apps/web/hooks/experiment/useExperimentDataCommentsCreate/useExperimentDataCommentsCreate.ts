import { tsr } from "~/lib/tsr";

export const useExperimentDataCommentsCreate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.createExperimentDataComments.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
