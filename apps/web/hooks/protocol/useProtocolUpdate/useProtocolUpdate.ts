import type { Protocol } from "@repo/api";

import { tsr } from "../../../lib/tsr";

interface ProtocolUpdateProps {
  onSuccess?: (protocol: Protocol) => void;
}

/**
 * Hook to update an existing protocol.
 * Updates create a new version with the same UUID — URL stays stable.
 */
export const useProtocolUpdate = (protocolId: string, props: ProtocolUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.updateProtocol.useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["protocol", protocolId] });
      await queryClient.cancelQueries({ queryKey: ["protocols"] });

      const previousProtocol = queryClient.getQueryData<{ body: Protocol }>([
        "protocol",
        protocolId,
      ]);

      return { previousProtocol };
    },
    onError: (error, variables, context) => {
      if (context?.previousProtocol) {
        queryClient.setQueryData(["protocol", protocolId], context.previousProtocol);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["protocol", protocolId] });
      await queryClient.invalidateQueries({ queryKey: ["protocols"] });
      await queryClient.invalidateQueries({ queryKey: ["protocol-versions"] });
      await queryClient.invalidateQueries({ queryKey: ["breadcrumbs"] });
    },
    onSuccess: (data) => {
      // URL stays stable (same UUID), just refetch shows the new version
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
