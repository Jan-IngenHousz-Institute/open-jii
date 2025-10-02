import { tsr } from "~/lib/tsr";

export const useExperimentDataCommentsDelete = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteExperimentDataComments.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
