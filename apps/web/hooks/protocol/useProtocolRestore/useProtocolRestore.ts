import { tsr } from "../../../lib/tsr";

/** Restore an old protocol version (mints a new version from it); invalidates caches. */
export const useProtocolRestore = (protocolId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.restoreProtocolVersion.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["protocol", protocolId] });
      await queryClient.invalidateQueries({ queryKey: ["protocolVersions", protocolId] });
    },
  });
};
