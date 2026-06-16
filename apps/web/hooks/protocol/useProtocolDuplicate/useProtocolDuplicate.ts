import { tsr } from "../../../lib/tsr";

/** Fork a protocol into a new entity seeded from its latest code. */
export const useProtocolDuplicate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.duplicateProtocol.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["protocols"] });
    },
  });
};
