import { tsr } from "~/lib/tsr";

export const useExperimentAnnotationDeleteBulk = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteAnnotationsBulk.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
