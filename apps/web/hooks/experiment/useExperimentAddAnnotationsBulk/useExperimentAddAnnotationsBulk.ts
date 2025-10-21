import { tsr } from "~/lib/tsr";

export const useExperimentAddAnnotationsBulk = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.addAnnotationsBulk.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
