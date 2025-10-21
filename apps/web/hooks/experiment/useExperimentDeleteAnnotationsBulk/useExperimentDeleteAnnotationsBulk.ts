import { tsr } from "~/lib/tsr";

export const useExperimentDeleteAnnotationsBulk = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteAnnotationsBulk.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
