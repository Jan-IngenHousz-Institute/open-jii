import { tsr } from "~/lib/tsr";

export const useExperimentAddAnnotation = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.addAnnotation.useMutation({
    // Invalidate and refetch experiment data
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["experiment"] });
    },
  });
};
