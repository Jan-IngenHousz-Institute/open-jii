import { tsr } from "~/lib/tsr";

export const useExperimentAnnotationAddBulk = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.addAnnotationsBulk.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
