import { tsr } from "../../../lib/tsr";

/** Restore an old macro version (mints a new version from it); invalidates caches. */
export const useMacroRestore = (macroId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.restoreMacroVersion.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["macro", macroId] });
      await queryClient.invalidateQueries({ queryKey: ["macroVersions", macroId] });
    },
  });
};
