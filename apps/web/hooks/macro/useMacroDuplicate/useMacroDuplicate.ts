import { tsr } from "../../../lib/tsr";

/** Fork a macro into a new entity seeded from its latest code. */
export const useMacroDuplicate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.duplicateMacro.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["macros"] });
    },
  });
};
