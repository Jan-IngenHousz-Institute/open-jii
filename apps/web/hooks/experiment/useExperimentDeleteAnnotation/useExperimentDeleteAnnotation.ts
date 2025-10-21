import { tsr } from "~/lib/tsr";

export const useExperimentDeleteAnnotation = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteAnnotation.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
